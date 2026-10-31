/* User-invoked deterministic self-tests; not PDF/OCR certification. */
(function(root){'use strict';
function runSelfChecks(){
 const G=root.GCFEngine,S=root.GCFScanner,P=root.GCFPDF,failures=[];let total=0;
 const check=(name,ok,actual='')=>{total++;if(!ok)failures.push(name+(actual?' [got '+actual+']':''));};
 if(!G||!S||!P)return {total:1,passed:0,failed:1,failures:['Missing scanner component'],ms:0};
 const started=performance.now();
 function scan(text,reading='auto'){return S.scanPage([{file:'self-test',page:1,lineNo:0,location:'Test',method:'Sample',text,parts:[]}],{reading,order:'auto'})[0]||null;}
 const prcFixtures=[["MONDAY, MAY 4, 2026","MATCH","Monday"],["TUESDAY, MAY 5, 2026","MATCH","Tuesday"],["WEDNESDAY, MAY 6, 2026","MATCH","Wednesday"],["THURSDAY, MARCH 26, 2026","MATCH","Thursday"],["FRIDAY, MARCH 27, 2026","MATCH","Friday"],["SUNDAY, MAY 24, 2026","MATCH","Sunday"],["MONDAY, MAY 25, 2026","MATCH","Monday"],["TUESDAY, MAY 26, 2026","MATCH","Tuesday"],["THURSDAY, MAY 7, 2026","MATCH","Thursday"],["FRIDAY, MAY 8, 2026","MATCH","Friday"],["THURSDAY, MARCH 5, 2026","MATCH","Thursday"],["FRIDAY, MARCH 6, 2026","MATCH","Friday"],["WEDNESDAY, FEB. 11, 2026","MATCH","Wednesday"],["THURSDAY, FEB. 12, 2026","MATCH","Thursday"],["FRIDAY, FEB. 13, 2026","MATCH","Friday"],["TUESDAY, JANUARY 20, 2026","MATCH","Tuesday"],["THURSDAY, JANUARY 22, 2026","MATCH","Thursday"],["THURSDAY, JANUARY 22, 2025","MISMATCH","Wednesday"],["MONDAY, NOVEMBER 24, 2025","MATCH","Monday"],["TUESDAY, NOVEMBER 25, 2025","MATCH","Tuesday"],["WEDNESDAY, NOVEMBER 26, 2025","MATCH","Wednesday"],["MONDAY, JANUARY 26, 2026","MATCH","Monday"],["TUESDAY, JANUARY 27, 2026","MATCH","Tuesday"],["WEDNESDAY, JANUARY 28, 2026","MATCH","Wednesday"],["WEDNESDAY, FEBRUARY 4, 2026","MATCH","Wednesday"],["THURSDAY, FEBRUARY 5, 2026","MATCH","Thursday"],["FRIDAY, FEBRUARY 6, 2026","MATCH","Friday"],["SATURDAY, AUGUST 1, 2026","MATCH","Saturday"],["SUNDAY, AUGUST 2, 2026","MATCH","Sunday"],["MONDAY, AUGUST 3, 2026","MATCH","Monday"],["SUNDAY, SEPTEMBER 20, 2026","MATCH","Sunday"],["THURSDAY, OCTOBER 15, 2026","MATCH","Thursday"],["FRIDAY OCTOBER 16, 2026","MATCH","Friday"],["Wednesday, May 20, 2026","MATCH","Wednesday"],["Thursday , May 21, 2026","MATCH","Thursday"],["Friday, May 22, 2026","MATCH","Friday"],["Saturday, November 14, 2026","MATCH","Saturday"],["Sunday , November 15, 2026","MATCH","Sunday"],["Monday, November 16, 2026","MATCH","Monday"],["SATURDAY, OCTOBER 4, 2025","MATCH","Saturday"],["SUNDAY, OCTOBER 5, 2025","MATCH","Sunday"],["SATURDAY, OCTOBER 11, 2025","MATCH","Saturday"],["SUNDAY, OCTOBER 12, 2025","MATCH","Sunday"],["SATURDAY, OCTOBER 18, 2025","MATCH","Saturday"],["SUNDAY, OCTOBER 19, 2025","MATCH","Sunday"],["MONDAY, OCTOBER 20, 2025","MATCH","Monday"],["THURSDAY, APRIL 16, 2026","MATCH","Thursday"]];
 for(const [input,want,weekday] of prcFixtures){try{const r=scan(input);check('PRC '+input,!!r&&r.status===want&&r.expected===weekday,r?.status+'/'+r?.expected);}catch(e){check('PRC '+input,false,e.message);}}
 const cases=[['MONDAY, MAY 4, 2026','MATCH','Monday'],['MAY 5, 2026, TUESDAY','MATCH','Tuesday'],['WEDNESDAY, MAY 6, 2026','MATCH','Wednesday'],['TUESDAY, MAY 4, 2026','MISMATCH','Monday'],['THURSDAY, FEBRUARY 29, 2024','MATCH','Thursday'],['MONDAY, FEBRUARY 29, 2025','INVALID',''],['MAY 4, 2026','DATE_ONLY','Monday'],['MONDAY, 2026-05-04','MATCH','Monday'],['2026-05-04, MONDAY','MATCH','Monday']];
 for(const [input,want,weekday] of cases){try{const r=scan(input);check('Pattern '+input,!!r&&r.status===want&&r.expected===weekday,r?.status+'/'+r?.expected);}catch(e){check('Pattern '+input,false,e.message);}}
 let seed=20261031;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 for(let k=0;k<240;k++){
  const year=2000+Math.floor(random()*90),month=1+Math.floor(random()*12),max=new Date(Date.UTC(year,month,0)).getUTCDate(),day=1+Math.floor(random()*max);
  const expected=G.DAYS[new Date(Date.UTC(year,month-1,day)).getUTCDay()];
  const input=k%2===0?expected+', '+months[month-1]+' '+day+', '+year:months[month-1]+' '+day+', '+year+', '+expected;
  try{const r=scan(input);check('Generated '+k,!!r&&r.status==='MATCH'&&r.expected===expected,r?.status+'/'+r?.expected);}catch(e){check('Generated '+k,false,e.message);}
 }
 try{const runs=[{str:'MON',transform:[12,0,0,12,60,700],width:26},{str:'DAY, ',transform:[12,0,0,12,86,700],width:34},{str:'MAY 4, 2026',transform:[12,0,0,12,124,700],width:96}];
  const lines=P.groupSpans(runs,1,'self-test.pdf');
  check('Split weekday reconstruction',lines.some(l=>/MONDAY,\s*MAY 4, 2026/.test(l.text)),lines.map(l=>l.text).join(' | '));
  const result=S.scanPage(lines,{reading:'auto'});
  check('Split weekday pairing',result.some(r=>r.status==='MATCH'&&r.expected==='Monday'),result.map(r=>r.status).join(','));
 }catch(e){check('Split weekday pairing',false,e.message);}
 return {total,passed:total-failures.length,failed:failures.length,failures,ms:Math.round(performance.now()-started)};
}
root.GCFQuality={runSelfChecks};
const button=typeof document!=='undefined'?document.getElementById('runSelfChecks'):null;
if(button)button.addEventListener('click',()=>{
 const output=document.getElementById('selfCheckResults');button.disabled=true;
 try{const r=runSelfChecks();output.textContent=r.passed+'/'+r.total+' checks passed in '+r.ms+' ms. '+(r.failed?'Failures: '+r.failures.slice(0,8).join(' | '):'Core date, pairing and 47 PRC source-derived cases passed.')+' This does not verify browser PDF.js, OCR, or PDF export.';output.style.color=r.failed?'#A12727':'#175A35';}
 catch(e){output.textContent='Self-check could not run: '+e.message;output.style.color='#A12727';}
 finally{button.disabled=false;}
});
})(typeof globalThis!=='undefined'?globalThis:this);
