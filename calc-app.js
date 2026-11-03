(function(){
'use strict';
const $=id=>document.getElementById(id),G=window.GCFEngine;
let latest='';
function calculate(){
 const y=Number($('calcYear').value),m=Number($('calcMonth').value),d=Number($('calcDay').value);
 if(!G.validDate(y,m,d)){
  latest='';$('calcResult').classList.add('hide');$('calcStatus').className='status error';
  $('calcStatus').textContent='Enter a valid Gregorian date (years 1–9999); February and leap years are checked automatically.';
  return;
 }
 const item=G.gcf(y,m,d),fast=G.gcf400(y,m,d);
 if(item.W!==fast){
  latest='';$('calcResult').classList.add('hide');$('calcStatus').className='status error';
  $('calcStatus').textContent='Independent GCF calculations disagreed; the result has been withheld. Try refreshing or report this issue.';
  return;
 }
 const weekday=G.DAYS[item.W],date=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}).format((()=>{const dt=new Date(Date.UTC(2000,m-1,d));dt.setUTCFullYear(y);return dt;})());
 latest=weekday+', '+date;
 $('calcResult').classList.remove('hide');$('calcStatus').className='status hide';
 $('calcWeekday').textContent=weekday;$('calcDate').textContent=date;
 for(const part of ['C','Y','M','D','W'])$('calc'+part).textContent=item[part];
 $('calcFormula').textContent=`(${item.C} + ${item.Y} + ${item.M} + ${item.D}) mod 7 = ${item.W} → ${weekday}`;
 $('calcCache').textContent=`Optimized cached residue: ${fast}; ${item.leap?'leap year':'common year'}; year within century: ${item.small}.`;
}
function setDate(d){
 $('calcMonth').value=String(d.getMonth()+1);
 $('calcDay').value=String(d.getDate());
 $('calcYear').value=String(d.getFullYear());
 calculate();
}
async function copy(){
 if(!latest){$('calcStatus').className='status warning';$('calcStatus').textContent='Calculate a valid date before copying.';return;}
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard permission unavailable');
  await navigator.clipboard.writeText(latest);
  $('calcStatus').className='status';$('calcStatus').textContent='Copied: '+latest;
 }catch(e){
  $('calcStatus').className='status warning';$('calcStatus').textContent='Clipboard is unavailable. You can select the weekday and date above to copy them.';
 }
}
$('calcRun').addEventListener('click',calculate);
$('calcExample').addEventListener('click',()=>{setDate(new Date(2026,11,1));});
$('calcToday').addEventListener('click',()=>setDate(new Date()));
$('calcCopy').addEventListener('click',copy);
for(const id of ['calcMonth','calcDay','calcYear']){
 $(id).addEventListener('change',calculate);
 $(id).addEventListener('input',()=>{if(id!=='calcYear'||$('calcYear').value.length>=4)calculate();});
}
calculate();
})();