/* GCF-400 document weekday/date association; positions matter.
   An unambiguous adjacent date and weekday is a classified pair with provenance.
   Ambiguity is always REVIEW rather than guessed. */
(function(root,factory){const api=factory(root.GCFEngine||(typeof require==='function'?require('./gcf-engine.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.GCFScanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(G){
'use strict';
if(!G)throw Error('GCF engine missing');
const MONTH='January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sep\\.?|Sept\\.?|Oct\\.?|Nov\\.?|Dec\\.?';
const DATE=new RegExp(`\\b(?:(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})[,]?\\s+(\\d{4})|(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})|(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4}))\\b`,'gi');
const WEEKDAY=/\b(Sunday|Sun\.?|Monday|Mon\.?|Tuesday|Tues\.?|Tue\.?|Wednesday|Wed\.?|Thursday|Thurs\.?|Thur\.?|Thu\.?|Friday|Fri\.?|Saturday|Sat\.?)\b/gi;
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function dateMatches(text,order='auto'){
 const output=[];
 for(const m of String(text??'').matchAll(DATE)){
  const a=m[1]?{y:+m[3],mo:MONTHS[m[1].slice(0,3).toLowerCase()],d:+m[2]}:m[4]?{y:+m[6],mo:MONTHS[m[5].slice(0,3).toLowerCase()],d:+m[4]}:m[7]?{y:+m[7],mo:+m[8],d:+m[9]}:{y:+m[12],mo:+m[10],d:+m[11]};
  let ambiguous=false;
  if(m[10]){
   const p=+m[10],q=+m[11];
   if(order==='MDY'){a.mo=p;a.d=q;}
   else if(order==='DMY'){a.mo=q;a.d=p;}
   else if(p<=12&&q<=12){ambiguous=true;a.mo=p;a.d=q;}
   else if(p>12&&q<=12){a.d=p;a.mo=q;}
   else if(q>12&&p<=12){a.d=q;a.mo=p;}
   else{a.d=p;a.mo=q;}
  }
  output.push({raw:m[0],start:m.index,end:m.index+m[0].length,iso:G.iso(a.y,a.mo,a.d),valid:G.validDate(a.y,a.mo,a.d),ambiguous,y:a.y,m:a.mo,d:a.d});
 }
 return output;
}
function dayMatches(text){return [...String(text??'').matchAll(WEEKDAY)].map(m=>({day:m[1],start:m.index,end:m.index+m[0].length,weekday:G.parseWeekday(m[1])}));}
function locateDate(line,date){
 const parts=line.parts||[];const matches=[];
 for(const p of parts){const t=String(p.text||'');const pos=t.toLowerCase().indexOf(date.raw.toLowerCase());if(pos>=0&&t.toLowerCase().indexOf(date.raw.toLowerCase(),pos+1)<0)matches.push({p,pos});}
 if(matches.length!==1)return null;
 const {p,pos}=matches[0],w=Number(p.width||0),rect=p.rect||p.pdfRect;
 if(!w||!rect||!p.text.length)return null;
 // Approximate only: export should report unresolved position if the source font is nonstandard.
 return {x0:rect.x0+pos/p.text.length*w-.7,x1:rect.x0+(pos+date.raw.length)/p.text.length*w+.7,y0:rect.y0,y1:rect.y1};
}
function classify(date,day,source,options={}){
 const row={file:source.file||'',page:source.page,location:source.location||'Page '+source.page,date:date.iso,sourceDate:date.raw,recorded:day?.day||'',expected:'',status:'',sourceText:source.text,method:source.method||'PDF text',confidence:source.confidence??null,rect:null,note:'',parts:source.parts||[],association:options.association||'none'};
 if(!date.valid){row.status='INVALID';row.note='Invalid Gregorian calendar date';return row;}
 if(date.ambiguous){row.status='REVIEW';row.note='Ambiguous numeric date order';return row;}
 const w=G.gcf400(date.y,date.m,date.d);row.expected=G.DAYS[w];
 if(!day){row.status=options.uncertain?'REVIEW':'NO_WEEKDAY';row.note=options.uncertain?'More than one weekday is plausible; verify the original document':'No associated weekday found';return row;}
 row.status=day.weekday===w?'MATCH':'MISMATCH';
 row.note=options.association==='adjacent'?'Paired with a uniquely associated weekday on an adjacent text line':options.association==='spatial'?'Paired by nearest unambiguous weekday in the same row':'Weekday and date appear on the same line';
 if((source.method||'').includes('OCR')&&(source.confidence??100)<75){row.status='REVIEW';row.note='Low OCR confidence: verify date and weekday on the original page';}
 row.rect=locateDate(source,date);
 if((source.method||'').includes('OCR')&&(source.confidence??0)<80)row.rect=null;
 return row;
}
function distance(date,weekday){return weekday.end<=date.start?date.start-weekday.end:date.end<=weekday.start?weekday.start-date.end:0;}
function getPairings(dates,days,line){
 const matched=new Map(),uncertain=new Set();if(!days.length)return {matched,uncertain};
 if(dates.length===1&&days.length===1){matched.set(0,{day:days[0],kind:'same-line'});return {matched,uncertain};}
 // Match each date to its closest weekday, using text offsets within this visual line.
 // Require uniqueness BOTH ways. Never reuse one weekday for multiple dates.
 const candidates=dates.map((d,di)=>days.map((w,wi)=>({di,wi,distance:distance(d,w)})).sort((a,b)=>a.distance-b.distance));
 const used=new Set();for(let di=0;di<dates.length;di++){
  const arr=candidates[di];if(!arr.length)continue;
  const closest=arr[0];const second=arr[1];
  if((second&&second.distance===closest.distance)||(closest.distance>80)){uncertain.add(di);continue;}
  const rejections=dates.filter((x,k)=>k!==di).map(x=>distance(x,days[closest.wi]));
  if(rejections.some(d=>d<=closest.distance)){uncertain.add(di);continue;}
  if(used.has(closest.wi)){uncertain.add(di);continue;}
  used.add(closest.wi);matched.set(di,{day:days[closest.wi],kind:'spatial'});
 }
 return {matched,uncertain};
}
function neighborCandidate(line,neighbor){
 if(!neighbor||neighbor.file!==line.file||neighbor.page!==line.page)return false;
 if(dateMatches(neighbor.text).length)return false;
 const days=dayMatches(neighbor.text);if(days.length!==1||neighbor.text.trim().length>95)return false;
 if(line.tableRow!=null||neighbor.tableRow!=null){if(line.tableRow!==neighbor.tableRow)return false;}
 else if(line.baseline!==undefined&&neighbor.baseline!==undefined&&Math.abs(line.baseline-neighbor.baseline)>28)return false;
 if(line.parts?.length&&neighbor.parts?.length){const ax=Math.min(...line.parts.map(p=>p.x||0)),bx=Math.min(...neighbor.parts.map(p=>p.x||0));if(Math.abs(ax-bx)>185)return false;}
 return true;
}
function scanPage(lines,opts={}){
 const rows=[];const ordered=[...lines].sort((a,b)=>(a.lineNo??0)-(b.lineNo??0));
 for(let i=0;i<ordered.length;i++){
  const line=ordered[i],dates=dateMatches(line.text,opts.order||'auto'),days=dayMatches(line.text);
  const pairing=getPairings(dates,days,line);
  for(let j=0;j<dates.length;j++){
   let found=pairing.matched.get(j),uncertain=pairing.uncertain.has(j),rowLine=line;
   if(!found&&!days.length&&dates.length===1){
    const nearby=[];
    for(const idx of [i-1,i+1]){
     if(neighborCandidate(line,ordered[idx]))nearby.push(ordered[idx]);
    }
    if(nearby.length===1){found={day:dayMatches(nearby[0].text)[0],kind:'adjacent'};rowLine={...line,text:line.text+' | '+nearby[0].text};}
    else if(nearby.length>1)uncertain=true;
   }
   rows.push(classify(dates[j],found?.day||null,rowLine,{association:found?.kind||'none',uncertain}));
  }
 }
 return rows;
}
function scanDocument(pages,opts={}){
 const records=[];for(const p of pages){const byPage=new Map();for(const l of p.lines||[]){const k=l.page??1;if(!byPage.has(k))byPage.set(k,[]);byPage.get(k).push(l);}for(const lines of byPage.values())records.push(...scanPage(lines,opts));}
 const counts=Object.fromEntries(['MATCH','MISMATCH','INVALID','REVIEW','NO_WEEKDAY'].map(x=>[x,0]));for(const r of records)counts[r.status]=(counts[r.status]||0)+1;
 return {records,counts,total:records.length,pairs:counts.MATCH+counts.MISMATCH,unpaired:counts.NO_WEEKDAY};
}
return {dateMatches,dayMatches,getPairings,scanPage,scanDocument,locateDate};
});
