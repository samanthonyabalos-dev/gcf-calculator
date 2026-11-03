/* Browser-free UI integration smoke test: exercises scan -> findings -> summary -> filter. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const events=new Map(),nodes=new Map();
function node(id=''){
 const classes=new Set();
 return {id,value:'',textContent:'',innerHTML:'',className:'',style:{},disabled:false,
  selectedOptions:[{text:'Automatic'}],files:[],
  classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),
    contains:x=>classes.has(x),toggle:(x,force)=>{if(force===undefined? !classes.has(x):force)classes.add(x);else classes.delete(x);}},
  addEventListener:(name,fn)=>events.set(id+':'+name,fn),
  replaceChildren:()=>{},appendChild:()=>{},querySelectorAll:()=>[],setAttribute:()=>{},closest:()=>null,
  getContext:()=>({}),click:()=>{},contains:()=>false
 };
}
const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
const file={name:'PRC-exam.pdf',size:12,arrayBuffer:async()=>new Uint8Array([37,80,68,70,45,49]).buffer,
 slice:()=>({arrayBuffer:async()=>new Uint8Array([37,80,68,70,45,49]).buffer})};
get('files').files=[file];get('reading').value='auto';get('ocr').value='off';get('order').value='auto';
get('resultFilter').value='ALL';
const record={file:file.name,page:1,sourceDate:'MAY 4, 2026',date:'2026-05-04',recorded:'Monday',expected:'Monday',
 status:'MATCH',sourceText:'MONDAY, MAY 4, 2026',hasDatePosition:true,hasDayPosition:true,rects:[],note:'Verified'};
const summary={records:[record],counts:{MATCH:1,MISMATCH:0,REVIEW:0,INVALID:0,DATE_ONLY:0}};
const context={
 document:{getElementById:get,createElement:()=>node('created')},
 GCFPDF:{readPdf:async()=>({file:file.name,pageCount:1,complete:true,
  lines:[{file:file.name,page:1,text:'MONDAY, MAY 4, 2026',method:'PDF text'}],
  coverage:[{file:file.name,page:1,status:'READABLE',nativeLines:1,ocrAttempted:false,durationMs:5}],unchecked:[]}),
  previewPage:async()=>({width:600,convertToViewportRectangle:rect=>rect}),closeOCR:async()=>{},closePreview:async()=>{},load:async()=>{}},
 GCFScanner:{scanDocument:()=>summary,dateMatches:x=>x.includes('2026')?[1]:[],dayMatches:x=>x.includes('MONDAY')?[1]:[]},
 GCFAuditUtils:{inspectNames:()=>true,inspectFile:async()=>true,summarize:(_rows,cov)=>({state:cov.length?'PAIRS CHECKED':'INCOMPLETE'}),manifest:()=>({})},
 GCFPdfExport:{create:async()=>({blob:new Blob([]),fullyAnnotated:1,unresolved:[]})},
 GCFWord:{read:async()=>({})},JSZip:class{},
 performance:{now:()=>100},Blob,Uint8Array,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},
 console,Promise,setTimeout,clearTimeout
};
context.globalThis=context;context.crypto={subtle:{digest:async()=>new Uint8Array(32).buffer}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../audit-app.js'),'utf8'),context,{filename:'audit-app.js'});
(async()=>{
 assert.equal(typeof events.get('scan:click'),'function','Scan handler must be registered');
 await events.get('scan:click')();
 await Promise.resolve();await Promise.resolve();
 assert.match(get('recordRows').innerHTML,/MATCH/);
 assert.equal(get('statMatches').textContent,'1');
 assert.match(get('scanQuality').textContent,/Overall audit state: PAIRS CHECKED/);
 assert.match(get('scanQuality').textContent,/Page coverage: 1\/1/);
 get('resultFilter').value='MISMATCH';events.get('resultFilter:change')();
 assert.match(get('previewNote').textContent,/Showing 0 of 0/);
 get('resultFilter').value='ALL';events.get('resultFilter:change')();
 assert.match(get('recordRows').innerHTML,/MONDAY|Monday/);
 console.log('GCF-400 UI smoke PASS: scan, quality state, finding display and filtering.');
})().catch(e=>{console.error(e);process.exitCode=1;});
