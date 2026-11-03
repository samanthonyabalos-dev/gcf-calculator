/* GCF-400 v25 — opt-in persistent CryptoKey continuity tests, IndexedDB shim. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
Object.defineProperty(globalThis,'crypto',{value:crypto,configurable:true});
const values=new Map();
const db={
 objectStoreNames:{contains:()=>true},
 createObjectStore:()=>{},
 transaction:(_name,_mode)=>{
  const transaction={oncomplete:null,onerror:null,onabort:null,
   objectStore:()=>({
    put:(value,key)=>request(()=>{values.set(key,value);return key;}),
    get:key=>request(()=>values.get(key)),
    delete:key=>request(()=>{values.delete(key);return undefined;})
   })
  };
  function request(cb){
   const req={onsuccess:null,onerror:null,result:null,error:null};
   queueMicrotask(()=>{
    try{req.result=cb();req.onsuccess?.();queueMicrotask(()=>transaction.oncomplete?.());}
    catch(e){req.error=e;req.onerror?.();transaction.onerror?.();}
   });
   return req;
  }
  return transaction;
 },
 close:()=>{}
};
globalThis.indexedDB={open:()=>{const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};queueMicrotask(()=>req.onsuccess?.());return req;}};
const S=require('../security-seal.js');
const evidence={schema:'gcf400-audit-evidence-v1',files:[],findings:[],summary:{state:'PAIRS CHECKED'}};
(async()=>{
 const first=await S.createDeviceKey();
 assert.match(first.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(values.has('device-signer'),true);
 const privateKey=values.get('device-signer').privateKey;
 assert.equal(privateKey.extractable,false,'Device private key must be non-exportable');
 await assert.rejects(crypto.subtle.exportKey('pkcs8',privateKey));
 const signed=await S.seal(evidence);
 assert.equal(signed.publicKeyFingerprint,first.fingerprint);
 S.resetSession();
 const reloaded=await S.useDeviceKey();
 assert.equal(reloaded.fingerprint,first.fingerprint,'Fingerprint must survive memory reset');
 const second=await S.seal(evidence);
 assert.equal(second.publicKeyFingerprint,first.fingerprint,'Signature continuity should survive a new session');
 assert.equal((await S.verify(second)).valid,true);
 await S.eraseDeviceKey();
 assert.equal(values.has('device-signer'),false,'Erased private key should not remain in storage');
 await assert.rejects(S.useDeviceKey(),/No device signing key/);
 assert.equal((await S.verify(signed)).valid,true,'Old signed evidence should remain independently verifiable');
 console.log('Device signing key PASS: non-exportability, opt-in creation, storage, reuse, erasure and old seal verification.');
})().catch(e=>{console.error(e);process.exitCode=1;});
