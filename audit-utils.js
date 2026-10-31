/* GCF-400 v19: local file-type checks and evidence summaries (no uploads). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFAuditUtils=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_FILE_BYTES=15*1024*1024,MAX_FILES=10;
const CATEGORIES=['MATCH','MISMATCH','REVIEW','INVALID','DATE_ONLY'];
function inspectNames(files){
 if(!Array.isArray(files)||!files.length)throw Error('Choose at least one PDF or DOCX file.');
 if(files.length>MAX_FILES)throw Error('A maximum of '+MAX_FILES+' documents is supported per scan.');
 const names=new Set();
 for(const f of files){
  const n=String(f?.name||'').trim();
  if(!/\.(pdf|docx)$/i.test(n))throw Error('Only PDF and DOCX documents are supported: '+n);
  if(!Number.isFinite(f?.size)||f.size<=0)throw Error('Empty or unreadable file: '+n);
  if(f.size>MAX_FILE_BYTES)throw Error('File exceeds 15 MB: '+n);
  if(names.has(n.toLowerCase()))throw Error('Duplicate file name. Rename one file: '+n);
  names.add(n.toLowerCase());
 }
 return true;
}
async function inspectFile(file){
 inspectNames([file]);
 if(typeof file.slice!=='function')throw Error('Cannot inspect document bytes: '+file.name);
 const bytes=new Uint8Array(await file.slice(0,Math.min(1024,file.size)).arrayBuffer());
 const ext=file.name.toLowerCase().endsWith('.pdf')?'PDF':'DOCX';
 if(ext==='PDF'){
  let signature=false;
  for(let i=0;i+4<bytes.length;i++){if(bytes[i]===37&&bytes[i+1]===80&&bytes[i+2]===68&&bytes[i+3]===70&&bytes[i+4]===45){signature=true;break;}}
  if(!signature)throw Error('This .pdf file does not contain a PDF signature: '+file.name);
 }else{
  if(bytes.length<4||bytes[0]!==80||bytes[1]!==75||![3,5,7].includes(bytes[2])||![4,6,8].includes(bytes[3]))throw Error('This .docx file is not a recognized ZIP-based Word document: '+file.name);
  // Document XML is validated separately when opening the OOXML package.
 }
 return {name:file.name,size:file.size,format:ext};
}
function summarize(rows=[],coverage=[]){
 const counts=Object.fromEntries(CATEGORIES.map(s=>[s,0]));
 for(const r of rows)if(Object.prototype.hasOwnProperty.call(counts,r.status))counts[r.status]++;
 const inspected=coverage.filter(p=>p.status==='READABLE'||p.status==='BLANK').length;
 const incomplete=coverage.filter(p=>!['READABLE','BLANK'].includes(p.status)).length;
 const paired=counts.MATCH+counts.MISMATCH;
 const located=rows.filter(r=>/\.pdf$/i.test(r.file||'')&&(!r.hasDatePosition||(['MATCH','MISMATCH'].includes(r.status)&&!r.hasDayPosition))).length;
 const state=incomplete?'INCOMPLETE':counts.MISMATCH||counts.INVALID||counts.REVIEW||located?'REVIEW REQUIRED':!paired?'NO CONFIRMED PAIRS':'PAIRS CHECKED';
 return {state,counts,inspected,incomplete,paired,missingHighlightPositions:located,examined:coverage.length};
}
function manifest({rows=[],coverage=[],quality=[],settings={},version='v19',generatedAt=new Date().toISOString()}={}){
 const summary=summarize(rows,coverage);
 return {schema:'gcf400-audit-evidence-v1',version,generatedAt,scope:'Browser-local weekday/date consistency audit (not document authentication)',summary,
  settings:{reading:String(settings.reading||'auto'),numericDateOrder:String(settings.order||'auto'),recognition:String(settings.ocr||'auto')},
  files:quality.map(f=>({file:String(f.file||''),bytes:Number(f.bytes)||0,sha256:f.sha256||null,pages:Number(f.pages)||0,processed:Number(f.processed)||0,unchecked:Number(f.unchecked)||0,dates:Number(f.dates)||0,matches:Number(f.matches)||0,mismatches:Number(f.mismatches)||0,review:Number(f.review)||0,processingMs:Number(f.elapsedMs)||0,outcome:String(f.outcome||'')})),
  pageCoverage:coverage.map(p=>({file:String(p.file||''),page:p.page,status:String(p.status||''),method:String(p.method||''),ocrAttempted:!!p.ocrAttempted,processingMs:Number(p.durationMs)||0})),
  caveats:['A hash identifies a file version; it is NOT a signed identity or tamper-proof audit trail.','Readable pages can still contain dates missed by extraction.','DATE_ONLY is not a weekday mismatch.','Uncertain results and incomplete highlight positions require human review.']
 };
}
return {MAX_FILE_BYTES,MAX_FILES,inspectNames,inspectFile,summarize,manifest};
});