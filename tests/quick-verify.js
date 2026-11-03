/* Quick-check regression tests: real parser, ambiguous input, safe one-line scope. */
'use strict';
const assert=require('node:assert/strict');
globalThis.GCFEngine=require('../gcf-engine.js');
globalThis.GCFScanner=require('../scan-core.js');
const quick=require('../quick-verify.js');
const cases=[
 ['MONDAY, MAY 4, 2026','MATCH','Monday'],
 ['May 5, 2026, Tuesday','MATCH','Tuesday'],
 ['Thursday, January 22, 2025','MISMATCH','Wednesday'],
 ['February 29, 2025','INVALID','Not available'],
 ['May 4, 2026','DATE_ONLY','Monday'],
 ['No weekday on this page','REVIEW',undefined],
 ['Monday, May 4, 2026; Tuesday, May 5, 2026','REVIEW',undefined],
 ['Monday, May 4, 2026\nTuesday, May 5, 2026','REVIEW',undefined],
];
for(const [input,status,expected] of cases){const result=quick.check(input);assert.equal(result.status,status,input);if(expected!==undefined)assert.equal(result.expected,expected,input);}
assert.equal(quick.check('<img src=x onerror=alert(1)>').status,'REVIEW');
assert.equal(quick.check('').status,'EMPTY');
console.log('GCF quick-verify PASS: '+(cases.length+2)+' cases.');
