/* GCF computational core — mathematical contribution is adopted ALBADORA/GCF;
   cache and record validation are implementations, not new calendar laws.
   Proleptic Gregorian dates, years 1-9999, weekday Sunday=0. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  root.GCFEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const COMMON=[6,2,2,5,0,3,5,1,4,6,2,4];
const LEAP=[5,1,2,5,0,3,5,1,4,6,2,4];
const MONTH_DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
const CENTURY=[7,5,3,1];
function isLeap(y){return y%400===0 || (y%4===0 && y%100!==0);}
function validDate(y,m,d){return Number.isInteger(y)&&y>=1&&y<=9999&&Number.isInteger(m)&&m>=1&&m<=12&&Number.isInteger(d)&&d>=1&&d<=MONTH_DAYS[m-1]+(m===2&&isLeap(y)?1:0);}
function gcf(y,m,d){const century=Math.floor(y/100),small=y%100,C=CENTURY[century%4],Y=(small+Math.floor(small/4))%7,M=(isLeap(y)?LEAP:COMMON)[m-1],W=(C+Y+M+d)%7;return {century,small,C,Y,M,D:d,W,leap:isLeap(y)};}
/* A zero-based 400-year-cycle index: index=0 means years 400,800,...; r=1 means years 1,401,... */
const CACHE=(()=>{const a=new Uint8Array(4800);for(let r=0;r<400;r++){const y=r||400,century=Math.floor(y/100),small=y%100,base=CENTURY[century%4]+small+Math.floor(small/4),months=isLeap(y)?LEAP:COMMON;for(let m=0;m<12;m++)a[r*12+m]=(base+months[m])%7;}return a;})();
function gcf400(y,m,d){return (CACHE[(y%400)*12+(m-1)]+d)%7;}
function zeller(y,m,d){if(m<3){m+=12;y--;}const k=y%100,j=Math.floor(y/100);const h=(d+Math.floor(13*(m+1)/5)+k+Math.floor(k/4)+Math.floor(j/4)-2*j)%7;return (h+13)%7;}
const GAUSS_MONTH=[0,3,2,5,0,3,5,1,4,6,2,4];
function gauss(y,m,d){if(m<3)y--;const c=Math.floor(y/100),g=y%100;let w=d+GAUSS_MONTH[m-1]+CENTURY[c%4]+g+Math.floor(g/4);return ((w%7)+7)%7;}
function sakamoto(y,m,d){if(m<3)y--;return (y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)+GAUSS_MONTH[m-1]+d)%7;}
const ORDINAL=[0,31,59,90,120,151,181,212,243,273,304,334];
function ordinal(y,m,d){const a=y-1;return (365*a+Math.floor(a/4)-Math.floor(a/100)+Math.floor(a/400)+ORDINAL[m-1]+d+(m>2&&isLeap(y)?1:0))%7;}
/* Carroll's 1887 four-item method, century item (6-2c) mod 7; year by dozens */
function carroll(y,m,d){const c=Math.floor(y/100),yy=y%100,q=Math.floor(yy/12),rem=yy%12;const month=[0,3,3,6,1,4,6,2,5,0,3,5][m-1];const leapFix=isLeap(y)&&m<=2?1:0;return ((6-2*(c%4)+q+rem+Math.floor(rem/4)+month+d-leapFix)%7+7)%7;}
/* Conway's Doomsday mental-calendar algorithm as a direct computational reference. */
const DOOM_MONTH_COMMON=[3,28,14,4,9,6,11,8,5,10,7,12];
const DOOM_MONTH_LEAP=[4,29,14,4,9,6,11,8,5,10,7,12];
function doomsday(y,m,d){const c=Math.floor(y/100),small=y%100,q=Math.floor(small/12),r=small%12;const centuryAnchor=[2,0,5,3][c%4];const annual=(centuryAnchor+q+r+Math.floor(r/4))%7;const ref=(isLeap(y)?DOOM_MONTH_LEAP:DOOM_MONTH_COMMON)[m-1];return ((annual+d-ref)%7+7)%7;}
function iso(y,m,d){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function parseISO(s){const x=String(s??'').trim().match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);if(!x)return null;const y=+x[1],m=+x[2],d=+x[3];return validDate(y,m,d)?{y,m,d,iso:iso(y,m,d)}:null;}
function fromSerial(serial){const n=Number(serial);if(!Number.isInteger(n)||n<1||n===60||n>2958465)return null;const d=new Date(Date.UTC(1899,11,31)+(n>60?n-1:n)*86400000);const y=d.getUTCFullYear(),m=d.getUTCMonth()+1,dd=d.getUTCDate();return validDate(y,m,dd)?{y,m,d:dd,iso:iso(y,m,dd)}:null;}
function parseDate(raw){const text=String(raw??'').trim();const isoDate=parseISO(text);if(isoDate)return isoDate;let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m){const y=+m[3],mo=+m[1],d=+m[2];return validDate(y,mo,d)?{y,m:mo,d,iso:iso(y,mo,d)}:null;}if(/^\d+$/.test(text))return fromSerial(text);return null;}
const BYDAY={sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
function parseWeekday(raw){const v=BYDAY[String(raw??'').trim().toLowerCase().replace(/\.$/,'')];return v===undefined?null:v;}
function difference(recorded,computed){const r=(recorded-computed+7)%7;return {residue:r,shift:r<=3?r:r-7};}
function nextDay(a){const monthMax=MONTH_DAYS[a.m-1]+(a.m===2&&isLeap(a.y)?1:0);if(a.d<monthMax)return {y:a.y,m:a.m,d:a.d+1,iso:iso(a.y,a.m,a.d+1)};if(a.m<12)return {y:a.y,m:a.m+1,d:1,iso:iso(a.y,a.m+1,1)};if(a.y===9999)return null;return {y:a.y+1,m:1,d:1,iso:iso(a.y+1,1,1)};}
/* Only unambiguous complete ISO dates: YYYY-MM-DD, YYYY-MM-DD..YYYY-MM-DD;
   YYYY-MM-DD;YYYY-MM-DD. ISO commas also accepted if CSV-quoted. */
function expandDates(raw,maxExpansion=62){const text=String(raw??'').trim();if(!text)return {error:'Missing date'};
  if(text.includes('..')){const parts=text.split('..');if(parts.length!==2)return {error:'Invalid date range'};const a=parseISO(parts[0]),b=parseISO(parts[1]);if(!a||!b)return {error:'Ranges require two complete ISO dates (YYYY-MM-DD..YYYY-MM-DD)'};const list=[];let cur=a;while(cur&&cur.iso<=b.iso&&list.length<=maxExpansion){list.push(cur);if(cur.iso===b.iso)break;cur=nextDay(cur);}if(!list.length||list.length>maxExpansion||list.at(-1).iso!==b.iso)return {error:'Range reversed or exceeds '+maxExpansion+' days'};return {dates:list};}
  if(/[;,]/.test(text)){const bits=text.split(/[;,]/).map(s=>s.trim()).filter(Boolean);if(!bits.length||bits.length>maxExpansion)return {error:'Unsupported date list length'};const dates=bits.map(parseISO);if(dates.some(x=>!x))return {error:'Date lists require complete ISO dates'};return {dates};}
  const a=parseDate(text);return a?{dates:[a]}:{error:'Invalid or ambiguous Gregorian date'};
}
function expandWeekdays(raw,count){const text=String(raw??'').trim();if(count===1)return {days:[parseWeekday(text)]};if(!text)return {error:'Missing corresponding weekday list'};let parts=text.split(/\s*(?:[,;|]|\s+[–—-]\s+|\s*\/\s*)\s*/).filter(Boolean);
  // Support compact "Sat-Sun" because both tokens contain letters, never numeric date fields here.
  if(parts.length===1 && /^[a-z]+\s*[-–—]\s*[a-z]+$/i.test(text))parts=text.split(/[-–—]/).map(s=>s.trim());
  if(parts.length!==count)return {error:'Provide one recorded weekday for each expanded date'};
  const days=parts.map(parseWeekday);return days.some(x=>x===null)?{error:'Unrecognized weekday label'}:{days};
}
function validateRecord(row,rowNum, dateIdx,dayIdx, maxExpansion=62){const rawDate=String(row[dateIdx]??''),rawDay=String(row[dayIdx]??'');const dateInfo=expandDates(rawDate,maxExpansion);const bad=(reason)=>[{sourceRow:rowNum,sourceDate:rawDate,date:rawDate,recorded:rawDay,expected:'',status:'INVALID',residue:'',shift:'',note:reason,original:row.slice()}];if(dateInfo.error)return bad(dateInfo.error);
  const daysInfo=expandWeekdays(rawDay,dateInfo.dates.length);if(daysInfo.error||daysInfo.days.some(x=>x===null))return bad(daysInfo.error||'Unrecognized recorded weekday');
  return dateInfo.dates.map((date,i)=>{const w=gcf400(date.y,date.m,date.d),r=daysInfo.days[i],df=difference(r,w);return {sourceRow:rowNum,sourceDate:rawDate,date:date.iso,recorded:DAYS[r],expected:DAYS[w],status:r===w?'MATCH':'MISMATCH',residue:df.residue,shift:df.shift,note:r===w?'Consistent':'Recorded weekday '+(df.shift>0?'+':'')+df.shift+' day(s) relative to calculated weekday; verify source',original:row.slice()};});
}
function detectColumns(header){const norm=header.map(s=>String(s??'').trim().toLowerCase());let date=norm.findIndex(s=>s==='date'||s==='date(s)'||s==='event date'||s==='exam date');let day=norm.findIndex(s=>s==='recorded weekday'||s==='weekday'||s==='day of week'||s==='day/s');if(date<0||day<0||date===day)throw Error('Required columns: Date and Recorded Weekday (or Weekday).');return {date,day};}
function validateMatrix(matrix){if(!matrix.length)throw Error('Dataset is empty');const header=matrix[0].map(s=>String(s??''));const ix=detectColumns(header);const results=[],counts={MATCH:0,MISMATCH:0,INVALID:0},shifts={'-3':0,'-2':0,'-1':0,'+1':0,'+2':0,'+3':0},inputRows=matrix.length-1;let nonempty=0,rangeRows=0;
 for(let i=1;i<matrix.length;i++){const row=(matrix[i]||[]).map(s=>String(s??''));if(!row.some(s=>s.trim()))continue;nonempty++;const res=validateRecord(row,i+1,ix.date,ix.day);if(res.length>1)rangeRows++;for(const entry of res){results.push(entry);counts[entry.status]++;if(entry.status==='MISMATCH')shifts[(entry.shift>0?'+':'')+entry.shift]++;}}
 const valid=counts.MATCH+counts.MISMATCH;return {header,results,counts,shifts,sourceRecords:nonempty,expandedRecords:results.length,rangeRows,agreement:valid?counts.MATCH/valid*100:0,engine:'GCF-400 cached'};
}
function parseDelimited(text){const src=String(text??'').replace(/^\uFEFF/,'');const delim=(src.split(/\r?\n/,1)[0]||'').includes('\t')?'\t':',';let row=[],cell='',quoted=false,rows=[];for(let i=0;i<src.length;i++){let ch=src[i];if(ch==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delim&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);row=[];cell='';}else cell+=ch;}if(quoted)throw Error('Unclosed quoted field');row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);return rows;}
return Object.freeze({DAYS,COMMON,LEAP,CACHE,isLeap,validDate,gcf,gcf400,zeller,gauss,sakamoto,ordinal,carroll,doomsday,iso,parseDate,parseWeekday,difference,expandDates,expandWeekdays,validateRecord,validateMatrix,parseDelimited});
});
