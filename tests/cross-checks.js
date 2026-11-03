/* Independent calendar parity + text/OCR disagreement acceptance tests. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../gcf-engine.js'),S=require('../scan-core.js'),P=require('../pdf-bridge.js');
const D=G.DAYS;
function scan(text,mod=S){return mod.scanPage([{file:'test.pdf',page:1,lineNo:0,text,parts:[]}],{reading:'auto'});}
let seed=1234;
function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/2**32;}
for(let n=0;n<2000;n++){
 const y=1+Math.floor(rnd()*9999),m=1+Math.floor(rnd()*12),max=new Date(Date.UTC(2000,m,0)).getUTCDate(),d=1+Math.floor(rnd()*max);
 if(!G.validDate(y,m,d))continue;
 const utc=new Date(Date.UTC(2000,m-1,d));utc.setUTCFullYear(y);
 assert.equal(G.gcf400(y,m,d),utc.getUTCDay(),'GCF/UTC parity '+[y,m,d]);
}
const incorrect={...G,gcf400:()=>0},vm=require('node:vm');
const context={module:{exports:{}},require:()=>incorrect};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scan-core.js'),'utf8'),context);
const mock=context.module;
assert.equal(scan('MONDAY, MAY 4, 2026',mock.exports)[0].status,'REVIEW','Internal disagreement must never claim MATCH');
assert.equal(scan('THURSDAY, JANUARY 22, 2025')[0].status,'MISMATCH');
function row(date,recorded,status='MATCH'){return {date,recorded,status};}
assert.equal(P.evidenceDisagreements([row('2026-05-04','Monday')],[row('2026-05-04','Tuesday')]).length,1);
assert.equal(P.evidenceDisagreements([row('2026-05-04','Monday')],[row('2026-05-04','Monday')]).length,0);
assert.equal(P.evidenceDisagreements([row('2026-05-04','Monday')],[row('2025-05-04','Sunday')]).length,1);
console.log('GCF-400 calendar parity & OCR discrepancy PASS: 2,000 generated attempts, intentional fault and 3 OCR comparisons.');
