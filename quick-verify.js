/* GCF-400 v22 — one-line source verification without file upload. */
(function(root,factory){const api=factory(root.GCFScanner||(typeof require==='function'?require('./scan-core.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.GCFQuick=api;})(typeof globalThis!=='undefined'?globalThis:this,function(scanner){
'use strict';
function check(line){
 const text=String(line??'').trim().normalize('NFKC');
 if(!text)return {status:'EMPTY',message:'Enter a printed weekday and date, or a date by itself.'};
 if(text.length>300)return {status:'REVIEW',message:'The line is too long. Copy one date heading (300 characters maximum).'};
 if(/[\r\n]/.test(text))return {status:'REVIEW',message:'Check one printed line at a time. Separate lines may have unrelated dates.'};
 if(!scanner)return {status:'ERROR',message:'Date scanner is not available.'};
 const findings=scanner.scanPage([{file:'Manual entry',page:1,lineNo:0,text,method:'Manual entry',parts:[]}],{reading:'auto',order:'auto'});
 if(!findings.length)return {status:'REVIEW',message:'No complete date expression found. Try “Monday, May 4, 2026”.'};
 if(findings.length!==1)return {status:'REVIEW',message:findings.length+' date expressions found. Check each date separately to avoid a false association.'};
 const r=findings[0];
 return {status:r.status,sourceDate:r.sourceDate,normalized:r.date,recorded:r.recorded||'Not printed',expected:r.expected||'Not available',
  message:r.status==='MATCH'?'Printed weekday agrees with the calculated weekday.':r.status==='MISMATCH'?'Printed weekday disagrees with the calendar.':r.status==='INVALID'?'Invalid Gregorian calendar date.':r.status==='DATE_ONLY'?'The date has no clearly associated printed weekday; this is not an error.':'The weekday/date association requires manual review.'};
}
if(typeof document!=='undefined'){
 const input=document.getElementById('quickInput'),button=document.getElementById('quickCheck'),result=document.getElementById('quickResult'),example=document.getElementById('quickExample');
 const show=()=>{
  const r=check(input.value);
  result.textContent='Status: '+r.status+'\n'+(r.sourceDate?'Date: '+r.sourceDate+'\n':'')+(r.recorded?'Printed weekday: '+r.recorded+'\n':'')+(r.expected?'Calculated weekday: '+r.expected+'\n':'')+r.message+'\nThis verifies weekday consistency, not the authenticity of a schedule.';
  result.dataset.state=r.status;result.hidden=false;
 };
 button?.addEventListener('click',show);
 example?.addEventListener('click',()=>{input.value='Thursday, January 22, 2025';show();input.focus();});
 input?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();show();}});
}
return {check};
});