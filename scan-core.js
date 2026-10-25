/* GCF-400 date/weekday parsing and transparent page association.
   No attempt to authenticate documents; classification is calendrical only. */
(function(root, factory){const api=factory(root.GCFEngine || (typeof require==='function'?require('./gcf-engine.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.GCFScanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(G){
'use strict';
if(!G)throw Error('gcf-engine.js must be loaded first');
const WEEKDAY=/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/ig;
const M='January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?';
const DATE=new RegExp(`\\b(?:(${M})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${M})[,]?\\s+(\\d{4})|(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})|(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4}))\\b`,'gi');
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function dateMatches(text,order='auto'){
 const result=[]; DATE.lastIndex=0;
 for(const m of String(text||'').matchAll(DATE)){
  const a=m[1]?{y:+m[3],mo:MONTHS[m[1].slice(0,3).toLowerCase()],d:+m[2]}:m[4]?{y:+m[6],mo:MONTHS[m[5].slice(0,3).toLowerCase()],d:+m[4]}:m[7]?{y:+m[7],mo:+m[8],d:+m[9]}:{y:+m[12],mo:+m[10],d:+m[11]};
  let ambiguous=false;
  if(m[10]){
   if(order==='MDY'){a.mo=+m[10];a.d=+m[11];}
   else if(order==='DMY'){a.d=+m[10];a.mo=+m[11];}
   else if(a.d<=12&&a.mo<=12)ambiguous=true;
   else if(a.d>12&&a.mo<=12){}
   else if(a.mo>12&&a.d<=12){const t=a.d;a.d=a.mo;a.mo=t;}
  }
  const valid=G.validDate(a.y,a.mo,a.d);
  result.push({raw:m[0],start:m.index,end:m.index+m[0].length,iso:String(a.y).padStart(4,'0')+'-'+String(a.mo).padStart(2,'0')+'-'+String(a.d).padStart(2,'0'),valid,ambiguous,y:a.y,m:a.mo,d:a.d});
 }
 return result;
}
function dayMatches(text){WEEKDAY.lastIndex=0;return [...String(text||'').matchAll(WEEKDAY)].map(m=>({day:m[1],start:m.index,end:m.index+m[0].length,weekday:G.parseWeekday(m[1])}));}
function classify(date,day,source,neighbor=null){
 const label={file:source.file||'',page:source.page,location:source.location||'Page '+source.page,date:date.iso,sourceDate:date.raw,recorded:day?.day||'',expected:'',status:'',sourceText:source.text,method:source.method||'PDF text',confidence:source.confidence??null,rect:null,note:'',parts:source.parts||[]};
 if(!date.valid){label.status='INVALID';label.note='Invalid Gregorian calendar date';return label;}
 if(date.ambiguous){label.status='REVIEW';label.note='Ambiguous numeric date order';return label;}
 const expected=G.DAYS[G.gcf400(date.y,date.m,date.d)];label.expected=expected;
 if(!day){label.status='NO_WEEKDAY';label.note='No uniquely associated written weekday';return label;}
 label.status=day.weekday===G.gcf400(date.y,date.m,date.d)?'MATCH':'MISMATCH';
 if(neighbor)label.note='Weekday associated from adjacent line, review layout';
 if((source.method||'').includes('OCR')&&(source.confidence??100)<70){label.status='REVIEW';label.note='Low-confidence OCR (manual confirmation required)';}
 label.rect=locateDate(source,date);
 return label;
}
function locateDate(line,date){
 const parts=line.parts||[];const match=parts.filter(p=>p.text&&p.text.toLowerCase().includes(date.raw.toLowerCase()));
 if(match.length!==1)return null;
 const p=match[0],i=p.text.toLowerCase().indexOf(date.raw.toLowerCase());
 const w=Number(p.width||0),full=p.text.length;if(!w||!full||!p.rect)return null;
 const left=p.rect.x0+(i/full)*w,right=p.rect.x0+(i+date.raw.length)/full*w;
 return {x0:left-.7,x1:right+.7,y0:p.rect.y0,y1:p.rect.y1};
}
function scanPage(lines,opts={}){
 const rows=[];const ordered=[...lines].sort((a,b)=>(a.lineNo??0)-(b.lineNo??0));
 for(let i=0;i<ordered.length;i++){
  const l=ordered[i],dates=dateMatches(l.text,opts.order||'auto'),days=dayMatches(l.text);
  for(const date of dates){
   let day=null,neighbor=false;
   // Unambiguous one-to-one pairing within a line; multiple dates with multiple weekdays must match by order.
   if(days.length===1&&dates.length===1)day=days[0];
   else if(days.length===dates.length&&dates.length>1)day=days[dates.indexOf(date)];
   else if(!days.length&&dates.length===1){
    const candidates=[];
    for(const idx of [i-1,i+1]){
     const other=ordered[idx];if(!other||dateMatches(other.text).length)continue;
     const wd=dayMatches(other.text);if(wd.length!==1||other.text.length>90)continue;
     if(l.baseline!==undefined&&other.baseline!==undefined&&Math.abs(l.baseline-other.baseline)>26)continue;
     if(l.parts?.length&&other.parts?.length&&Math.abs(l.parts[0].x-other.parts[0].x)>125)continue;
     candidates.push(wd[0]);
    }
    if(candidates.length===1){day=candidates[0];neighbor=true;}
   }
   rows.push(classify(date,day,l,neighbor));
  }
 }
 return rows;
}
function scanDocument(pageTexts,opts={}){
 const found=[];for(const p of pageTexts){const lines=p.lines||[];found.push(...scanPage(lines,opts));}
 const count={MATCH:0,MISMATCH:0,INVALID:0,REVIEW:0,NO_WEEKDAY:0};for(const r of found)count[r.status]=(count[r.status]||0)+1;
 return {records:found,counts:count,total:found.length,pairs:count.MATCH+count.MISMATCH,unpaired:count.NO_WEEKDAY};
}
return {dateMatches,dayMatches,scanPage,scanDocument,locateDate};
});
