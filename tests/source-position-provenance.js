/* Source-position evidence regression: preserve text-only functionality, do not certify partial positioned pairs.
   These are synthetic source-geometry fixtures; not a patent novelty test or real PDF benchmark. */
'use strict';
const assert=require('node:assert/strict');
globalThis.GCFEngine=require('../gcf-engine.js');
const Scanner=require('../scan-core.js');
const U=require('../audit-utils.js');
const rect=(text,x0,x1,y=100)=>({text,rect:{x0,x1,y0:y,y1:y+12}});
const line=(text,parts=[],lineNo=1,tableRow)=>({file:'fixture.pdf',page:1,lineNo,text,parts,tableRow,method:'PDF text'});
function check(name,lines,wantStatus,wantEvidence){
 const out=Scanner.scanPage(lines);
 assert.equal(out.length,1,name+': expected one date');
 assert.equal(out[0].status,wantStatus,name+': status');
 assert.equal(out[0].positionEvidence,wantEvidence,name+': source evidence');
 return out[0];
}
const complete=check('complete located pair',[line('Monday, November 16, 2026',[rect('Monday',10,58),rect(', ',58,65),rect('November 16, 2026',75,195)])],'MATCH','located');
check('located mismatch',[line('Friday, November 16, 2026',[rect('Friday',10,58),rect(', ',58,65),rect('November 16, 2026',75,195)])],'MISMATCH','located');
const partial=check('partial positioned weekday/date',[line('Monday, November 16, 2026',[rect('November 16, 2026',75,195)])],'REVIEW','partial');
assert.equal(partial.preliminaryClassification,'MATCH','The original classifier outcome is recorded, not silently overwritten');
assert.match(partial.note,/Incomplete source positions/);
check('text-only fallback unchanged',[line('Monday, November 16, 2026')],'MATCH','unavailable');
check('text-only mismatch unchanged',[line('Friday, November 16, 2026')],'MISMATCH','unavailable');
check('unpaired date unchanged',[line('November 16, 2026')],'DATE_ONLY','unavailable');
check('invalid date unchanged',[line('Monday, February 30, 2026')],'INVALID','unavailable');
check('separated unrelated columns',[line('Friday, November 16, 2026',[rect('Friday',0,40),rect(', ',41,45),rect('November 16, 2026',245,355)])],'REVIEW','partial');
check('adjacent located weekday',[line('Monday',[rect('Monday',80,125,100)],1),line('November 16, 2026',[rect('November 16, 2026',126,245,110)],2)],'MATCH','located');
check('separate table rows',[line('Tuesday',[rect('Tuesday',80,125,100)],1,1),line('November 16, 2026',[rect('November 16, 2026',126,245,110)],2,2)],'DATE_ONLY','located');
const evidence=U.manifest({rows:[complete,partial],coverage:[],quality:[]});
assert.equal(evidence.findings[0].positionEvidence,'located');
assert.equal(evidence.findings[1].positionEvidence,'partial');
assert.equal(evidence.findings[1].preliminaryClassification,'MATCH');
assert.equal(evidence.findings[1].status,'REVIEW');
console.log('Position provenance PASS: 10 synthetic cases, text-only parity and manifest evidence checked.');