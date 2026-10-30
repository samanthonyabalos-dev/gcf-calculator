/* GCF-400 document weekday/date association; positions matter.
   An unambiguous adjacent date and weekday is a classified pair with provenance.
   Ambiguity is always REVIEW rather than guessed. */
(function(root,factory){const api=factory(root.GCFEngine||(typeof require==='function'?require('./gcf-engine.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.GCFScanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(G){
'use strict';
if(!G)throw Error('GCF engine missing');
const MONTH='January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sep\\.?|Sept\\.?|Oct\\.?|Nov\\.?|Dec\\.?';
const DATE=new RegExp(`\\b(?:(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,\\s*|\\s+)(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})[,]?\\s+(\\d{4})|(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})|(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4}))\\b`,'gi');
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
function dayMatches(text){return [...String(text??'').normalize('NFKC').replace(/[\u00a0\u200b-\u200d\ufeff]/g,' ').matchAll(WEEKDAY)].map(m=>({day:m[1],start:m.index,end:m.index+m[0].length,weekday:G.parseWeekday(m[1])}));}
// Resolve a printed phrase to the actual OCR/PDF.js glyphs. Strip punctuation
// only for matching; always calculate boxes from the unchanged source glyphs.
// Repeated matches are deliberately unresolved rather than assigned at random.
function locateRects(line,phrase){
 const spans=(line.parts||[]).filter(p=>p&&p.text&&p.rect);
 if(!spans.length||!phrase)return [];
 const canonical=x=>String(x).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
 const token=canonical(phrase);if(!token)return [];
 const indexes=[];let text='';
 for(const [i,p] of spans.entries()){
  const value=String(p.text).normalize('NFKC').toLowerCase();
  for(let j=0;j<value.length;j++)if(/[a-z0-9]/.test(value[j])){text+=value[j];indexes.push({i,j,n:value.length});}
 }
 const start=text.indexOf(token);
 if(start<0||text.indexOf(token,start+1)!==-1)return [];
 const selected=new Map();
 for(let k=start;k<start+token.length;k++){
  const t=indexes[k],entry=selected.get(t.i)||{from:t.j,to:t.j+1,n:t.n};
  entry.from=Math.min(entry.from,t.j);entry.to=Math.max(entry.to,t.j+1);selected.set(t.i,entry);
 }
 const boxes=[];
 for(const [i,part] of selected){
  const r=spans[i].rect,x0=Number(r.x0),x1=Number(r.x1),y0=Number(r.y0),y1=Number(r.y1);
  if(![x0,x1,y0,y1].every(Number.isFinite)||x1<=x0||y1<=y0)return [];
  const f=part.from/Math.max(1,part.n),t=part.to/Math.max(1,part.n);
  boxes.push({x0:x0+(x1-x0)*f-.65,x1:x0+(x1-x0)*t+.65,y0:y0-.6,y1:y1+.6});
 }
 if(!boxes.length)return [];
 const bounds=unionRects(boxes),highest=Math.max(...boxes.map(r=>r.y1-r.y0));
 if(bounds.y1-bounds.y0>Math.max(32,highest*2.5)||bounds.x1-bounds.x0>700)return [];
 // Avoid bridging unrelated table columns or wrapped paragraphs. A multi-token
 // date should have nearby constituent glyphs in the original document.
 for(let i=1;i<boxes.length;i++){
  const prev=boxes[i-1],curr=boxes[i];
  const hgap=Math.max(0,Math.max(curr.x0,prev.x0)-Math.min(curr.x1,prev.x1));
  const ygap=Math.abs((curr.y0+curr.y1-prev.y0-prev.y1)/2);
  if(hgap>95||ygap>17)return [];
 }
 return boxes;
}
function unionRects(rects){return {x0:Math.min(...rects.map(r=>r.x0)),x1:Math.max(...rects.map(r=>r.x1)),y0:Math.min(...rects.map(r=>r.y0)),y1:Math.max(...rects.map(r=>r.y1))};}
function locateDate(line,date){const r=locateRects(line,date?.raw);return r.length?unionRects(r):null;}
function classify(date,day,source,options={}){
 const dateRects=locateRects(source,date.raw),daySource=options.daySource||source;
 const dayRects=day?locateRects(daySource,day.day):[];
 const rects=[...dateRects,...dayRects],rect=rects.length?unionRects(rects):null;
 const row={file:source.file||'',page:source.page,location:source.location||'Page '+source.page,date:date.iso,sourceDate:date.raw,recorded:day?.day||'',expected:'',status:'',sourceText:source.text,method:source.method||'PDF text',confidence:Math.min(...[source.confidence,daySource.confidence].filter(v=>Number.isFinite(v)).map(Number).concat([100])),rect,rects,hasDatePosition:dateRects.length>0,hasDayPosition:!!day&&dayRects.length>0,note:'',parts:source.parts||[],association:options.association||'none'};
 if(!date.valid){row.status='INVALID';row.note='Invalid Gregorian calendar date';return row;}
 if(date.ambiguous){row.status='REVIEW';row.note='Ambiguous numeric date order';return row;}
 const w=G.gcf400(date.y,date.m,date.d);row.expected=G.DAYS[w];
 if(!day){row.status=options.uncertain?'REVIEW':'DATE_ONLY';row.note=options.uncertain?(options.nearDay?'Detected '+options.nearDay.day+' near the date, but it does not meet the selected weekday–date reading rule; REVIEW required':'A weekday is nearby but cannot be paired unambiguously; verify the source'):'Date appears without a directly associated printed weekday; informational, not a weekday mismatch';if(options.uncertain&&options.nearDay)row.recorded=options.nearDay.day;return row;}
 row.status=day.weekday===w?'MATCH':'MISMATCH';
 row.note=options.association==='adjacent'?'Uniquely associated weekday from adjacent page fragment':options.association==='spatial'?'Paired by nearest unambiguous weekday in the same row':'Weekday and date appear on the same line';
 if((source.method||'').includes('OCR')&&row.confidence<75){row.status='REVIEW';row.note='Low OCR confidence: verify date and weekday on the original page';}
 return row;
}
function distance(date,weekday){return weekday.end<=date.start?date.start-weekday.end:date.end<=weekday.start?weekday.start-date.end:0;}
// Reading rule is intentionally separate from DMY/MDY numeric-date order.
// A valid association requires a contiguous weekday/date phrase, not merely
// proximity to an unrelated weekday somewhere in the paragraph.
function orientedGap(date,weekday,reading='auto'){
 const preceding=weekday.end<=date.start,following=date.end<=weekday.start;
 if(!preceding&&!following)return null;
 if(reading==='DAY_DATE'&&!preceding)return null;
 if(reading==='DATE_DAY'&&!following)return null;
 return preceding?{from:weekday.end,to:date.start}:{from:date.end,to:weekday.start};
}
function safeSeparator(segment,weekdayBefore=false){
 if(segment.length>28||/[;|]/.test(segment))return false;
 // A full stop is allowed ONLY after a weekday abbreviation (e.g. Thu.,),
 // not as a sentence boundary after a date.
 if(segment.includes('.'))return weekdayBefore&&/^\s*\.\s*,?\s*$/.test(segment);
 return /^[\s,:()\[\]\u2013\u2014\-\/]*$/.test(segment);
}
function getPairings(dates,days,line,opts={}){
 const matched=new Map(),uncertain=new Set(),disallowed=new Map();if(!days.length)return {matched,uncertain,disallowed};
 const reading=opts.reading||'auto',candidates=[];
 for(let di=0;di<dates.length;di++)for(let wi=0;wi<days.length;wi++){
   const gap=orientedGap(dates[di],days[wi],reading);
   if(!gap||!safeSeparator(line.text.slice(gap.from,gap.to),days[wi].end<=dates[di].start))continue;
   // PDF.js can place unrelated left/right table columns on the same baseline.
   // Never certify a weekday/date association solely from joined text if
   // source-glyph boxes are separated by a wide physical gap.
   const dr=locateDate(line,dates[di]),wr=locateDate(line,{raw:days[wi].day});
   if(dr&&wr){
     const physicalGap=Math.max(0,Math.max(dr.x0,wr.x0)-Math.min(dr.x1,wr.x1));
     const centerGap=Math.abs((dr.y0+dr.y1)/2-(wr.y0+wr.y1)/2);
     if(physicalGap>95||centerGap>15){uncertain.add(di);continue;}
   }
   const charGap=gap.to-gap.from;
   candidates.push({di,wi,distance:charGap});
 }
 // Choose only mutually unique closest candidates. Multiple equally plausible
 // candidates are explicitly REVIEW, never silently assigned.
 const claimedDays=new Set();
 for(let di=0;di<dates.length;di++){
   const suitable=candidates.filter(c=>c.di===di).sort((a,b)=>a.distance-b.distance);
   if(!suitable.length){
     // If a clearly adjacent weekday exists, but in the forbidden order,
     // classify as REVIEW rather than falsely labeling it DATE ONLY.
     const conflicting=days.filter(w=>{const any=orientedGap(dates[di],w,'auto');
       return any&&safeSeparator(line.text.slice(any.from,any.to),w.end<=dates[di].start);
     });
     if(conflicting.length===1)disallowed.set(di,conflicting[0]);
     if(conflicting.length||(dates.length===1&&days.length===1&&distance(dates[di],days[0])<90))uncertain.add(di);
     continue;
   }
   const best=suitable[0];
   if(suitable[1]&&suitable[1].distance===best.distance){uncertain.add(di);continue;}
   const others=candidates.filter(c=>c.wi===best.wi&&c.di!==di);
   if(others.some(c=>c.distance<=best.distance)||claimedDays.has(best.wi)){
      uncertain.add(di);continue;
   }
   claimedDays.add(best.wi);matched.set(di,{day:days[best.wi],kind:'same-line'});
 }
 return {matched,uncertain,disallowed};
}
// PDF.js may split a visibly continuous heading into separate text items/lines.
// Resolve geometry across ALL plausible lines on the same page, not only i ± 1.
// Never associate with a weekday in a separate table row or faraway paragraph.
function lineRegion(line){const ps=line.parts||[];if(!ps.length)return null;
 const left=Math.min(...ps.map(p=>Number(p.rect?.x0??p.x)).filter(Number.isFinite));
 const right=Math.max(...ps.map(p=>Number(p.rect?.x1??((p.x||0)+(p.width||0)))).filter(Number.isFinite));
 const lo=Math.min(...ps.map(p=>Number(p.rect?.y0??p.y)).filter(Number.isFinite));
 const hi=Math.max(...ps.map(p=>Number(p.rect?.y1??p.y)).filter(Number.isFinite));
 if(![left,right,lo,hi].every(Number.isFinite))return null;return {left,right,lo,hi,midY:(lo+hi)/2};
}
function weekdayCandidates(line,ordered,reading='auto'){
 const a=lineRegion(line),out=[];
 for(const neighbor of ordered){
  if(neighbor===line||neighbor.file!==line.file||neighbor.page!==line.page)continue;
  // With an explicit reading direction, never pair a weekday on the wrong side.
  if(reading==='DAY_DATE'&&neighbor.lineNo!=null&&line.lineNo!=null&&neighbor.lineNo>line.lineNo)continue;
  if(reading==='DATE_DAY'&&neighbor.lineNo!=null&&line.lineNo!=null&&neighbor.lineNo<line.lineNo)continue;
  if(line.tableRow!=null||neighbor.tableRow!=null){if(line.tableRow!==neighbor.tableRow)continue;}
  if(dateMatches(neighbor.text).length)continue;
  const days=dayMatches(neighbor.text);if(days.length!==1||String(neighbor.text).trim().length>65)continue;
  const b=lineRegion(neighbor);
  if(a&&b){
   // Same visible row (baseline drift), or immediately neighboring line.
   const verticalGap=Math.max(0,Math.max(a.lo,b.lo)-Math.min(a.hi,b.hi));
   if(verticalGap>19)continue;
   const h=Math.max(1,Math.min(a.hi-a.lo,b.hi-b.lo));
   if(Math.abs(a.midY-b.midY)>Math.max(35,2.8*h))continue;
   const horizontalGap=Math.max(0,Math.max(a.left,b.left)-Math.min(a.right,b.right));
   // Consecutive fragments in a heading or aligned column; reject a different column.
   if(horizontalGap>95 && Math.abs(a.left-b.left)>100)continue;
  }else if((line.lineNo!=null&&neighbor.lineNo!=null)&&Math.abs(line.lineNo-neighbor.lineNo)>2)continue;
  else if((line.tableRow==null&&neighbor.tableRow==null)&&(!a||!b)&&line.lineNo==null)continue;
  if((!a||!b)&&String(neighbor.text).trim().replace(/[\s.,;:()\-]/g,'').toLowerCase()!==days[0].day.toLowerCase().replace(/\./g,''))continue;
  const rank=(a&&b)?Math.abs(a.midY-b.midY)+Math.max(0,Math.max(a.left,b.left)-Math.min(a.right,b.right))*.04:Math.abs((line.lineNo??0)-(neighbor.lineNo??0))*16;
  out.push({line:neighbor,day:days[0],rank});
 }
 return out.sort((a,b)=>a.rank-b.rank);
}
function scanPage(lines,opts={}){
 const rows=[],ordered=[...lines].sort((a,b)=>(a.lineNo??0)-(b.lineNo??0));
 for(let i=0;i<ordered.length;i++){
  const line=ordered[i],dates=dateMatches(line.text,opts.order||'auto'),days=dayMatches(line.text);
  const pairing=getPairings(dates,days,line,opts);
  for(let j=0;j<dates.length;j++){
   let found=pairing.matched.get(j),uncertain=pairing.uncertain.has(j),rowLine=line;
   if(!found&&!days.length&&dates.length===1){
    const possible=weekdayCandidates(line,ordered,opts.reading||'auto');
    if(possible.length){
     const closest=possible[0],runnerUp=possible[1];
     // If two equally plausible weekdays are printed around the date, don't guess.
     if(runnerUp&&Math.abs(runnerUp.rank-closest.rank)<4)uncertain=true;
     else{found={day:closest.day,kind:'adjacent',daySource:closest.line};
       rowLine=line;}
    }
   }
   const rec=classify(dates[j],found?.day||null,rowLine,{association:found?.kind||'none',uncertain,nearDay:pairing.disallowed?.get(j)||null,daySource:found?.daySource});
   // Preserve original source line and the evidence used for a separated weekday.
   rec.sourceText=line.text;rec.dayEvidence=found?.kind==='adjacent'?(found.daySource.text+' | '+line.text):line.text;
   if(found?.kind==='adjacent')rec.note+='; verify adjacent-line association';
   rows.push(rec);
  }
 }
 return rows;
}
function scanDocument(pages,opts={}){
 const records=[];for(const p of pages){const byPage=new Map();for(const l of p.lines||[]){const k=l.page??1;if(!byPage.has(k))byPage.set(k,[]);byPage.get(k).push(l);}for(const lines of byPage.values())records.push(...scanPage(lines,opts));}
 const counts=Object.fromEntries(['MATCH','MISMATCH','INVALID','REVIEW','DATE_ONLY'].map(x=>[x,0]));for(const r of records)counts[r.status]=(counts[r.status]||0)+1;
 return {records,counts,total:records.length,pairs:counts.MATCH+counts.MISMATCH,unpaired:counts.DATE_ONLY};
}
return {dateMatches,dayMatches,getPairings,scanPage,scanDocument,locateDate,locateRects,weekdayCandidates};
});
