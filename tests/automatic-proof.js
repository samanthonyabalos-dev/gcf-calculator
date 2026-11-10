/* End-to-end mock-browser regression for automatic signing and ZIP verification. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
Object.defineProperty(globalThis,'crypto',{value:crypto.webcrypto,configurable:true});
const Security=require('../security-seal.js');
const Audit=require('../audit-utils.js');
const JSZip=require('../jszip.min.js');
const events=new Map(),elements=new Map(),generated=[];
const blobs=new Map();
let blobSequence=0,verification=null;
function node(id='') {
 const classes=new Set();
 return {id,value:'',textContent:'',innerHTML:'',className:'',style:{},dataset:{},hidden:false,disabled:false,
  files:[],selectedOptions:[{text:'Automatic'}],
  classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),
   contains:x=>classes.has(x),toggle:(x,on)=>{if(on===undefined?!classes.has(x):on)classes.add(x);else classes.delete(x);}},
  addEventListener:(name,fn)=>events.set(id+':'+name,fn),appendChild:()=>{},replaceChildren:()=>{},
  querySelectorAll:()=>[],setAttribute:()=>{},closest:()=>null,contains:()=>false,
  getContext:()=>({}),click(){if(this.download)generated.push({name:this.download,blob:blobs.get(this.href)});}
 };
}
const get=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id);};
const bytes=Buffer.from('%PDF-1.7\nmock source document');
const sourceFile={name:'demo.pdf',size:bytes.length,
 arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),
 slice:(a,b)=>({arrayBuffer:async()=>bytes.subarray(a,b).buffer.slice(bytes.subarray(a,b).byteOffset,bytes.subarray(a,b).byteOffset+bytes.subarray(a,b).byteLength)})};
get('files').files=[sourceFile];get('reading').value='auto';get('ocr').value='off';
get('order').value='auto';get('resultFilter').value='ALL';
const record={file:'demo.pdf',page:1,sourceDate:'MAY 4, 2026',date:'2026-05-04',recorded:'Monday',
 expected:'Monday',status:'MATCH',sourceText:'MONDAY, MAY 4, 2026',hasDatePosition:true,hasDayPosition:true,
 confidence:100,note:'Test',rects:[]};
const counters={MATCH:1,MISMATCH:0,INVALID:0,REVIEW:0,DATE_ONLY:0};
const context={
 document:{getElementById:get,createElement:()=>node('created')},
 GCFPDF:{readPdf:async()=>({file:'demo.pdf',pageCount:1,complete:true,
    lines:[{file:'demo.pdf',page:1,text:'MONDAY, MAY 4, 2026',method:'PDF text'}],
    coverage:[{file:'demo.pdf',page:1,status:'READABLE',method:'PDF text',nativeLines:1,ocrAttempted:false,durationMs:5}],unchecked:[]}),
   previewPage:async()=>{throw Error('Preview skipped in this test');},
   closeOCR:async()=>{},closePreview:async()=>{},load:async()=>{}},
 GCFScanner:{scanDocument:()=>({records:[record],counts:{...counters}}),
   dateMatches:s=>s.includes('2026')?[1]:[],dayMatches:s=>s.includes('MONDAY')?[1]:[]},
 GCFAuditUtils:Audit,GCFPdfExport:{create:async()=>({blob:Uint8Array.from([37,80,68,70,45]),fullyAnnotated:1,unresolved:[]})},
 GCFWord:{read:async()=>({})},GCFSecurity:Security,
 GCFSecurityUI:{keyStatus:()=>{},copyFingerprint:async()=>true,verificationStatus:x=>{verification=x;}},
 JSZip,performance:{now:()=>100},Blob,Uint8Array,
 URL:{createObjectURL:blob=>{const uri='blob:test-'+(++blobSequence);blobs.set(uri,blob);return uri;},revokeObjectURL:()=>{}},
 crypto:crypto.webcrypto,console,Promise,confirm:()=>true
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audit-app.js'),'utf8'),context,{filename:'audit-app.js'});
(async()=>{
 await events.get('scan:click')();
 await events.get('downloadPackage:click')();
 const exported=generated.find(x=>x.name==='GCF400_Audit_Reports.zip');
 assert.ok(exported?.blob,'One-click report ZIP must be produced');
 const contents=await JSZip.loadAsync(Buffer.from(await exported.blob.arrayBuffer()));
 assert.ok(contents.file('GCF_Findings.csv'),'Findings must remain included');
 assert.ok(contents.file('Annotated/demo_Annotated.pdf'),'Annotated output must remain included');
 const proof=contents.file('Verification/GCF400_Signed_Evidence.json');
 assert.ok(proof,'Signed audit proof must be bundled automatically, without Create key or Save proof clicks');
 const envelope=JSON.parse(await proof.async('string'));
 assert.equal((await Security.verify(envelope)).valid,true,'Proof must verify with the public key');
 assert.equal((await Security.verifySourceFile(envelope,sourceFile)).sourceMatch,true,'Original source digest must match');
 const altered=structuredClone(envelope);altered.evidence.findings[0].status='MISMATCH';
 assert.equal((await Security.verify(altered)).valid,false,'Changed audit findings must invalidate signature');
 const input=Buffer.from(await exported.blob.arrayBuffer());input.name='GCF400_Audit_Reports.zip';input.size=input.length;
 get('verifyEvidenceFile').files=[input];get('verifySourceFile').files=[sourceFile];
 await events.get('verifyEvidence:click')();
 assert.equal(verification?.state,'success','Uploading the ZIP directly must pass verification');
 assert.match(verification.message,/intact/i);
 console.log('Automatic audit report PASS: scan -> ZIP -> signed evidence -> tamper rejection -> one-file ZIP verification.');
})().catch(e=>{console.error(e);process.exitCode=1;});
