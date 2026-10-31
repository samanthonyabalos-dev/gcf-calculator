/* GCF-400 v17 deterministic regression tests. Run: node tests/regression.js */
'use strict';
const assert=require('node:assert/strict');
globalThis.GCFEngine=require('../gcf-engine.js');
globalThis.GCFScanner=require('../scan-core.js');
globalThis.GCFPDF=require('../pdf-bridge.js');
require('../quality-app.js');
const result=globalThis.GCFQuality.runSelfChecks();
assert.equal(result.total,251,'Expected 251 checks');
assert.equal(result.failed,0,'Regression failures: '+result.failures.join(' | '));
const scanner=globalThis.GCFScanner;
function runLine(text){return scanner.scanPage([{file:'regression.pdf',page:1,lineNo:0,text,method:'Test',parts:[]}],{reading:'auto'});}
const prc=['MONDAY, MAY 4, 2026','TUESDAY, MAY 5, 2026','WEDNESDAY, MAY 6, 2026'];
for(const text of prc){const findings=runLine(text);assert.equal(findings.length,1);assert.equal(findings[0].status,'MATCH');}
assert.equal(runLine('TUESDAY, MAY 4, 2026')[0].status,'MISMATCH');
assert.equal(runLine('FEBRUARY 29, 2025')[0].status,'INVALID');
assert.equal(runLine('MAY 4, 2026')[0].status,'DATE_ONLY');
console.log('GCF-400 regression: '+result.passed+'/'+result.total+' core checks passed; PRC weekday test cases passed; '+result.ms+' ms.');
console.log('NOTE: These tests do not establish PDF.js OCR accuracy or cross-reader annotation compatibility.');
