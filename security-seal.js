/* GCF-400 v24 · Browser-local cryptographic audit seals.
 * ECDSA P-256 signatures prove consistency with the INCLUDED public key,
 * not the real-world identity of whoever generated or possesses that key.
 * Keys are generated per session, kept in memory, and NEVER exported privately.
 * Web Crypto secure context required. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFSecurity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ENCODER=new TextEncoder();
const MAX_JSON=2*1024*1024;
let keyPair=null;
function canonical(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Non-finite values are not supported');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){
  return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 }
 throw Error('Unsupported evidence data type');
}
function bytesToBase64(bytes){
 let s='';for(const b of bytes)s+=String.fromCharCode(b);
 if(typeof btoa==='function')return btoa(s);
 if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
 throw Error('Base64 encoding unavailable');
}
function base64ToBytes(s){
 if(typeof s!=='string'||s.length>8192||!/^[A-Za-z0-9+/]*={0,2}$/.test(s)||s.length%4)throw Error('Invalid signature encoding');
 if(typeof atob==='function')return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));
 throw Error('Base64 decoding unavailable');
}
function secureCrypto(){
 const api=(typeof globalThis!=='undefined'?globalThis.crypto:undefined);
 if(!api?.subtle||!api?.getRandomValues)throw Error('Web Crypto unavailable: use HTTPS and a modern browser');
 return api;
}
function hex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function hashObject(value){
 const digest=await secureCrypto().subtle.digest('SHA-256',ENCODER.encode(canonical(value)));
 return hex(new Uint8Array(digest));
}
async function generateSessionKey(){
 keyPair=await secureCrypto().subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 return true;
}
function resetSession(){keyPair=null;}
async function seal(evidence){
 if(!evidence||evidence.schema!=='gcf400-audit-evidence-v1')throw Error('Expected GCF-400 evidence JSON');
 if(!keyPair)await generateSessionKey();
 const api=secureCrypto(),spki=new Uint8Array(await api.subtle.exportKey('spki',keyPair.publicKey));
 const payload=ENCODER.encode(canonical(evidence));
 if(payload.length>MAX_JSON)throw Error('Evidence exceeds 2 MB limit');
 const signature=new Uint8Array(await api.subtle.sign({name:'ECDSA',hash:'SHA-256'},keyPair.privateKey,payload));
 const digest=await api.subtle.digest('SHA-256',payload);
 const fp=await api.subtle.digest('SHA-256',spki);
 return {schema:'gcf400-evidence-seal-v1',algorithm:'ECDSA-P256-SHA256',
   createdAt:new Date().toISOString(),publicKeySpki:bytesToBase64(spki),
   publicKeyFingerprint:hex(new Uint8Array(fp)),payloadSHA256:hex(new Uint8Array(digest)),
   signature:bytesToBase64(signature),evidence,
   limitations:['Signature proves the evidence matches this included public key; it does not verify the signer identity.',
   'Session signing key is not bound to a person, organization or government certificate.',
   'A fully new seal can be created by anyone; do not infer PRC authenticity.']
 };
}
async function verify(sealed){
 if(!sealed||typeof sealed!=='object'||sealed.schema!=='gcf400-evidence-seal-v1')return {valid:false,reason:'Not a GCF-400 signed evidence envelope'};
 if(sealed.algorithm!=='ECDSA-P256-SHA256')return {valid:false,reason:'Unsupported signature algorithm'};
 try{
  if(!sealed.evidence||sealed.evidence.schema!=='gcf400-audit-evidence-v1')return {valid:false,reason:'Missing GCF-400 evidence payload'};
  const api=secureCrypto(),payload=ENCODER.encode(canonical(sealed.evidence));
  if(payload.length>MAX_JSON)return {valid:false,reason:'Evidence exceeds verifier size limit'};
  const spki=base64ToBytes(sealed.publicKeySpki),signature=base64ToBytes(sealed.signature);
  if(spki.length<40||spki.length>512||signature.length<32||signature.length>200)return {valid:false,reason:'Invalid public key or signature length'};
  const publicKey=await api.subtle.importKey('spki',spki,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const verified=await api.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,payload);
  const digest=hex(new Uint8Array(await api.subtle.digest('SHA-256',payload)));
  const fingerprint=hex(new Uint8Array(await api.subtle.digest('SHA-256',spki)));
  const valid=verified&&digest===sealed.payloadSHA256&&fingerprint===sealed.publicKeyFingerprint;
  return {valid,reason:valid?'Signature, evidence hash and embedded public-key fingerprint match. Signer identity is NOT authenticated.':'Signature, digest or public-key fingerprint mismatch',fingerprint,hash:digest};
 }catch(e){return {valid:false,reason:'Verification failed: '+e.message};}
}
async function verifySourceFile(sealed,file){
 const result=await verify(sealed);
 if(!result.valid)return {...result,sourceMatch:false};
 if(!file||typeof file.arrayBuffer!=='function')return {...result,sourceMatch:false,reason:'Select the original source file for comparison'};
 const matches=sealed.evidence.files?.filter(x=>x.file===file.name);
 if(!Array.isArray(matches)||matches.length!==1)return {...result,sourceMatch:false,reason:'Source file name is not uniquely listed in this audit'};
 if(!/^[a-f0-9]{64}$/i.test(matches[0].sha256||''))return {...result,sourceMatch:false,reason:'The source hash was not recorded'};
 const bytes=await file.arrayBuffer();
 if(bytes.byteLength>15*1024*1024)return {...result,sourceMatch:false,reason:'Source file exceeds 15 MB'};
 const actual=hex(new Uint8Array(await secureCrypto().subtle.digest('SHA-256',bytes)));
 const sourceMatch=actual===matches[0].sha256.toLowerCase()&&file.size===matches[0].bytes;
 return {...result,sourceMatch,reason:sourceMatch?'Signature valid and selected source file hash matches. Signer identity remains unverified.':'The selected source differs from the one recorded in the audit',actual};
}
function parseEnvelope(raw){
 if(typeof raw!=='string'||raw.length>MAX_JSON*2)throw Error('Evidence seal JSON is too large');
 const obj=JSON.parse(raw);
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Expected a seal JSON object');
 return obj;
}
return {canonical,hashObject,generateSessionKey,resetSession,seal,verify,verifySourceFile,parseEnvelope};
});