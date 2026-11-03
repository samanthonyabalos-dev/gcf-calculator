/* GCF-400 v24 cryptographic evidence security tests. */
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
Object.defineProperty(globalThis,'crypto',{value:crypto.webcrypto,configurable:true});
const S=require('../security-seal.js');
const evidence={
 schema:'gcf400-audit-evidence-v1',
 files:[{file:'exam.pdf',bytes:9,sha256:crypto.createHash('sha256').update(Buffer.from('exam-data')).digest('hex')}],
 settings:{reading:'auto',recognition:'off'},summary:{state:'PAIRS CHECKED',paired:1}
};
const sourceBytes=Buffer.from('exam-data');
const file={name:'exam.pdf',size:sourceBytes.length,arrayBuffer:async()=>sourceBytes};
(async()=>{
 assert.equal(S.canonical({z:2,a:1}),S.canonical({a:1,z:2}));
 const sealed=await S.seal(evidence);
 assert.equal(sealed.schema,'gcf400-evidence-seal-v1');
 assert.equal(sealed.algorithm,'ECDSA-P256-SHA256');
 assert.equal((await S.verify(sealed)).valid,true,'Signature should verify with its embedded key');
 assert.equal((await S.verifySourceFile(sealed,file)).sourceMatch,true,'Source hash should match');
 const altered=JSON.parse(JSON.stringify(sealed));altered.evidence.summary.paired=100;
 assert.equal((await S.verify(altered)).valid,false,'Tampering with the evidence must invalidate signature');
 const changedSig=JSON.parse(JSON.stringify(sealed));changedSig.signature=changedSig.signature.replace(/^./,changedSig.signature[0]==='A'?'B':'A');
 assert.equal((await S.verify(changedSig)).valid,false,'Signature changes must fail');
 const fakeFp=JSON.parse(JSON.stringify(sealed));fakeFp.publicKeyFingerprint='f'.repeat(64);
 assert.equal((await S.verify(fakeFp)).valid,false,'Fingerprint changes must fail');
 const originalFile={...file,arrayBuffer:async()=>Buffer.from('exam-dAta')};
 assert.equal((await S.verifySourceFile(sealed,originalFile)).sourceMatch,false,'Source modifications must fail');
 assert.equal((await S.verify({schema:'unknown'})).valid,false,'Reject unknown envelopes');
 assert.throws(()=>S.parseEnvelope('not json'));
 assert.equal((await S.verify(sealed)).reason.includes('Signer identity is NOT authenticated'),true,'Never falsely imply identity verification');
 assert.ok(!('privateKey' in sealed),'Private signing key must never be exported');
 S.resetSession();
 assert.equal((await S.verify(sealed)).valid,true,'Independent verification should work after signing key is destroyed');
 console.log('GCF-400 security seal PASS: canonical payload, signing, independent verify, tampering, fingerprint, source hash, privacy, and identity limitations.');
})().catch(e=>{console.error(e);process.exitCode=1;});
