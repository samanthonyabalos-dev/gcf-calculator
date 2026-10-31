/* node tests/hardening.js — file validation and evidence semantics */
'use strict';
const assert=require('node:assert/strict'),U=require('../audit-utils.js');
const sample=(name,bytes)=>({name,size:bytes.length,slice:(a,b)=>({arrayBuffer:async()=>Uint8Array.from(bytes.slice(a,b)).buffer})});
(async()=>{
const pdf=sample('exam.pdf',[37,80,68,70,45,49,46,55,10,32]);
const docx=sample('exam.docx',[80,75,3,4,10,1]);
assert.equal((await U.inspectFile(pdf)).format,'PDF');
assert.equal((await U.inspectFile(docx)).format,'DOCX');
await assert.rejects(U.inspectFile(sample('fake.pdf',[80,75,3,4,3])),/PDF signature/);
await assert.rejects(U.inspectFile(sample('fake.docx',[37,80,68,70,45])),/ZIP-based/);
assert.throws(()=>U.inspectNames([pdf,pdf]),/Duplicate/);
assert.throws(()=>U.inspectNames([sample('empty.pdf',[])]),/Empty/);
const rows=[{status:'MATCH',file:'exam.pdf',hasDatePosition:true,hasDayPosition:true},{status:'MISMATCH',file:'exam.pdf',hasDatePosition:false,hasDayPosition:false}];
const good=[{file:'exam.pdf',page:1,status:'READABLE'}];
assert.equal(U.summarize(rows,good).state,'REVIEW REQUIRED');
assert.equal(U.summarize([],good).state,'NO CONFIRMED PAIRS');
assert.equal(U.summarize([],[{page:1,status:'SKIPPED'}]).state,'INCOMPLETE');
const item=U.manifest({rows,coverage:good,quality:[{file:'exam.pdf',bytes:10,sha256:'abc',pages:1,processed:1}],settings:{reading:'auto'}});
assert.equal(item.files[0].sha256,'abc');assert.equal(item.summary.missingHighlightPositions,1);
assert.ok(item.caveats.some(x=>x.includes('NOT a signed')));
console.log('GCF-400 hardening: 11 checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});