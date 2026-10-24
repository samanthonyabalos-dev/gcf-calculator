/* GCF Document Audit — deterministic extraction, no AI or network requests.
   Original GCF is retained; validation uses GCFEngine.gcf400.
   Modes: source document text, paragraphs and table rows. Supports typed DOCX and textual PDFs.
   This module deliberately avoids guesses for ambiguous numeric dates. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./gcf-engine.js'):root.GCFEngine); if(typeof module==='object'&&module.exports)module.exports=api;root.GCFDocumentAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(GCF){
'use strict';
const MONTHS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const MNAME='(?:January|February|March|April|May|June|July|August|September|Sept\\.?|Sep\\.?|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Oct\\.?|Nov\\.?|Dec\\.?)';
const DATE_PATTERN=new RegExp('\\b(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}|'+MNAME+'\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+'+MNAME+'[,]?\\s+\\d{4}|\\d{4}[,]?\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+'+MNAME+')\\b','gi');
const WEEK_PATTERN=/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tues|Tue|Weds|Wed|Thurs|Thur|Thu|Fri|Sat)\b/gi;
function cleanMonth(s){return MONTHS[String(s||'').toLowerCase().replace(/\./g,'')]||null;}
function dateObject(y,m,d){if(!GCF.validDate(y,m,d))return null;return {y,m,d,iso:GCF.iso(y,m,d)};}
function parseDateValue(text,mode='auto'){
 const v=String(text??'').trim();let match, y,m,d;
 if((match=v.match(new RegExp('^('+MNAME+')\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})$','i'))))return {date:dateObject(+match[3],cleanMonth(match[1]),+match[2]),format:'MONTH_DAY_YEAR'};
 if((match=v.match(new RegExp('^(\\d{1,2})(?:st|nd|rd|th)?\\s+('+MNAME+')[,]?\\s+(\\d{4})$','i'))))return {date:dateObject(+match[3],cleanMonth(match[2]),+match[1]),format:'DAY_MONTH_YEAR'};
 if((match=v.match(new RegExp('^(\\d{4})[,]?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+('+MNAME+')$','i'))))return {date:dateObject(+match[1],cleanMonth(match[3]),+match[2]),format:'YEAR_DAY_MONTH'};
 if((match=v.match(/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/))){y=+match[1];let a=+match[3],b=+match[4];
   if(match[2]==='-'){m=a;d=b;}else if(mode==='YDM'){m=b;d=a;}else if(mode==='YMD'){m=a;d=b;}
   else if(a>12&&b<=12){m=b;d=a;}else if(b>12&&a<=12){m=a;d=b;}else if(a<=12&&b<=12)return {ambiguous:true,reason:'Ambiguous year-first numeric date. Select YMD or YDM.',raw:v};
   else return {date:null,reason:'Invalid year-first date',raw:v};return {date:dateObject(y,m,d),format:d===a&&match[2]!=='-'?'YEAR_DAY_MONTH':'YEAR_MONTH_DAY'};
 }
 if((match=v.match(/^(\d{1,2})([-/])(\d{1,2})\2(\d{4})$/))){let a=+match[1],b=+match[3];y=+match[4];
  if(mode==='DMY'){d=a;m=b;}else if(mode==='MDY'){m=a;d=b;}else if(a>12&&b<=12){d=a;m=b;}else if(b>12&&a<=12){d=b;m=a;}
  else if(a<=12&&b<=12)return {ambiguous:true,reason:'Ambiguous numeric date. Choose DMY or MDY.',raw:v};else return {date:null,reason:'Invalid numeric date',raw:v};
  return {date:dateObject(y,m,d),format:d===a?'DAY_MONTH_YEAR':'MONTH_DAY_YEAR'};
 }
 return {date:null,reason:'Unsupported date form',raw:v};
}
function makeRecord(segment,dateHit,dayHit,mode='auto',ambiguous=false){
 const parsed=parseDateValue(dateHit.text,mode);let status='UNVERIFIABLE',expected='',shift='',residue='',note='',dateISO='',recorded=dayHit?.text||'',format=parsed.format||'', matched=Boolean(dayHit);
 if(parsed.ambiguous){status='REVIEW';note=parsed.reason||'Ambiguous date order';}
 else if(!parsed.date){status='INVALID';note=parsed.reason||'Invalid Gregorian date';}
 else {dateISO=parsed.date.iso;
   if(!dayHit){status='NO_WEEKDAY';note='A date was found without a reliably associated weekday.';}
   else if(ambiguous){status='REVIEW';note='More than one possible weekday association; verify the source.';}
   else {const w=GCF.gcf400(parsed.date.y,parsed.date.m,parsed.date.d),observed=GCF.parseWeekday(dayHit.text);expected=GCF.DAYS[w];
    if(observed===null){status='REVIEW';note='Unrecognized weekday';}
    else {const x=GCF.difference(observed,w);residue=x.residue;shift=x.shift;status=observed===w?'MATCH':'MISMATCH';note=status==='MATCH'?'Consistent':'Recorded weekday differs by '+(shift>0?'+':'')+shift+' weekday positions';}
   }
 }
 return {file:segment.file||'',page:segment.page||'',location:segment.location||'',kind:segment.kind||'',pdfParts:segment.parts||null,sourceText:segment.text,sourceDate:dateHit.text,date:dateISO,recorded,expected,status,residue,shift,note,format,matched};
}
function scanRanges(segment,options={}){
 const line=String(segment.text||'').replace(/\s+/g,' ').trim();
 const week='(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat)';
 const wpair=new RegExp(week+'\\s*[-–—]\\s*'+week,'i');
 const dates=new RegExp('('+MNAME+')\\s+(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2}),?\\s*(\\d{4})','i');
 const dm=dates.exec(line),wm=wpair.exec(line);
 if(!dm||!wm)return null;
 const month=cleanMonth(dm[1]),d1=+dm[2],d2=+dm[3],year=+dm[4];
 // This parser only resolves unambiguous two-day ranges in the same month.
 if(d2!==d1+1||!GCF.validDate(year,month,d1)||!GCF.validDate(year,month,d2))return null;
 const tokens=[{text:dm[1]+' '+d1+', '+year},{text:dm[1]+' '+d2+', '+year}];
 const labels=[wm[1],wm[2]],result=[];
 for(let i=0;i<2;i++)result.push(makeRecord({...segment,text:line},tokens[i],{text:labels[i]},'auto',false));
 return result;
}
function scanText(segment,options={}){
 const input=String(segment.text||'').replace(/\s+/g,' ').trim(); if(!input)return [];
 const ranges=scanRanges({...segment,text:input},options);if(ranges)return ranges;
 const dates=[...input.matchAll(DATE_PATTERN)].map(m=>({text:m[0],index:m.index,end:m.index+m[0].length}));
 const days=[...input.matchAll(WEEK_PATTERN)].map(m=>({text:m[0],index:m.index,end:m.index+m[0].length}));
 const out=[];
 // Assign weekday mentions to the closest date first. Unlike a sliding window, this
 // prevents the weekday immediately preceding the NEXT date from making the
 // previous pair look ambiguous. No weekday can be assigned twice.
 const assigned=dates.map(()=>[]);
 for(const day of days){
  const choices=dates.map((d,i)=>{
   const dist=day.index>=d.end?day.index-d.end:day.end<=d.index?d.index-day.end:0;
   const between=day.index>=d.end?input.slice(d.end,day.index):input.slice(day.end,d.index);
   // Never associate a weekday in a previous sentence with a date in the next.
   // Avoid false MISMATCH flags in documents that discuss unrelated calendar facts.
   const crossesSentence=/(?:[.!?]\s+[A-Za-z])/.test(between);
   return {i,dist,crossesSentence};
  }).filter(z=>z.dist<=56&&!z.crossesSentence).sort((a,b)=>a.dist-b.dist);
  if(!choices.length)continue;
  if(choices.length>1 && choices[0].dist===choices[1].dist){
   // A tie represents an unresolved association; do not silently force it.
   assigned[choices[0].i].push({...day,unresolved:true});
   assigned[choices[1].i].push({...day,unresolved:true});
  } else assigned[choices[0].i].push(day);
 }
 for(let i=0;i<dates.length;i++){
  const d=dates[i],candidates=assigned[i];
  // Numbered legal cases can look like a year-first date, e.g. No. RTJ-13-2361, 02 February.
  if(/^\d{4}\s*,\s*\d{1,2}\s+[A-Z]/i.test(d.text) && /(?:\b(?:No\.|Case|A\.?M\.?|RTJ|P-?\d+)[^|]{0,75}[-–]\s*)$/i.test(input.slice(Math.max(0,d.index-85),d.index))) continue;
  const association=candidates.length===1?candidates[0]:candidates[0]||null;
  const ambiguity=candidates.length>1 || Boolean(association&&association.unresolved);
  out.push(makeRecord({...segment,text:input},d,association,options.dateOrder||'auto',ambiguity));
 }
 return out;
}
function summarize(records,files=0,elapsed=0){const counts={MATCH:0,MISMATCH:0,INVALID:0,REVIEW:0,NO_WEEKDAY:0};const shifts={'-3':0,'-2':0,'-1':0,'+1':0,'+2':0,'+3':0};
 for(const r of records){counts[r.status]=(counts[r.status]||0)+1;if(r.status==='MISMATCH'){const k=(r.shift>0?'+':'')+r.shift;if(k in shifts)shifts[k]++;}}
 return {records,counts,shifts,files,total:records.length,elapsedMs:elapsed};}
function scanSegments(segments,options={}){const t=Date.now();let out=[];for(const seg of segments){out.push(...scanText(seg,options));if(options.maxRecords&&out.length>options.maxRecords)throw Error('Document exceeded the configured record limit. Split it into smaller files.');}return summarize(out,new Set(segments.map(x=>x.file)).size,Date.now()-t);}
function xmlText(html){return String(html).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function docxSegmentsFromXml(xml,file='document.docx'){
 // Extract all paragraphs in physical document order. JSZip is supplied by the existing website.
 // Support ordinary text, line breaks, tab characters, and separate table cells.
 const segs=[];let paraIndex=0,tableRow=0;
 const body=String(xml).match(/<w:body(?:\s[^>]*)?>([\s\S]*?)<\/w:body>/)?.[1]||String(xml);
 // Preserve paragraph text even inside tables; the row can include multiple cells and will be scanned as a single line.
 const blocks=body.match(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)||[];
 const para=(node)=>{let x='';for(const token of node.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)||[]){if(token.startsWith('<w:t'))x+=xmlText(token.replace(/^<w:t(?:\s[^>]*)?>/,'').replace(/<\/w:t>$/,''));else x+=' ';}return x.trim();};
 for(const block of blocks){if(/^<w:tbl/.test(block)){const rows=block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g)||[];for(const row of rows){tableRow++;const cells=row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g)||[];const line=cells.map(cell=>(cell.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)||[]).map(para).filter(Boolean).join(' ')).join(' | ');if(line.trim())segs.push({file,location:'Table row '+tableRow,kind:'table',text:line});}}else {paraIndex++;const line=para(block);if(line)segs.push({file,location:'Paragraph '+paraIndex,kind:'paragraph',text:line});}}
 return segs;
}
async function readDocx(blob,JSZipCtor,file='document.docx'){
 if(!JSZipCtor)throw Error('ZIP parser missing: jszip.min.js is required.');const zip=await JSZipCtor.loadAsync(blob);const content=zip.file('word/document.xml');if(!content)throw Error('Invalid DOCX: word/document.xml not found.');const xml=await content.async('string');if(xml.length>25_000_000)throw Error('DOCX uncompressed content exceeds 25 MB; split the document.');return docxSegmentsFromXml(xml,file);
}
function asciiUnescapePDF(s){
 const raw=s.replace(/\\([nrtbf()\\])/g,(_,c)=>({n:'\n',r:'\r',t:'\t',b:'',f:'','(':'(',')':')','\\':'\\'}[c])).replace(/\\([0-7]{1,3})/g,(_,n)=>String.fromCharCode(parseInt(n,8))).replace(/\\\r?\n/g,'');
 // Standard WinAnsi punctuation; PDF literal strings can encode en/em dashes as 0x96/0x97.
 return raw.replace(/[\x91-\x97]/g,c=>({'\x91':'‘','\x92':'’','\x93':'“','\x94':'”','\x95':'•','\x96':'–','\x97':'—'}[c]||c));
}
function textFromPdfStream(stream){
  // Decode text drawing operators and preserve x/y coordinates for same-row table cells.
  const parts=[];const tokenize=/(?:BT[\s\S]*?ET)|(?:-?\d+(?:\.\d+)?\s+){6}cm|\bq\b|\bQ\b/g;
  let matrix=[1,0,0,1,0,0], stack=[],token;
  while((token=tokenize.exec(stream))){const str=token[0];
    if(str==='q'){stack.push(matrix.slice());continue;}
    if(str==='Q'){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
    if(str.endsWith('cm')&&str!=='ET'){
      const n=str.replace(/cm$/,'').trim().split(/\s+/).map(Number);
      if(n.length===6){const [a,b,c,d,e,f]=matrix,[g,h,i,j,k,l]=n;matrix=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];}continue;
    }
    if(!str.startsWith('BT'))continue;
    let txt='';const op=/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:[^\]]|\][^\s])*?\]\s*TJ|\((?:\\.|[^\\)])*\)\s*'|\((?:\\.|[^\\)])*\)\s*"/g;let m;
    while((m=op.exec(str))){const chunks=[...m[0].matchAll(/\((?:\\.|[^\\)])*\)/g)].map(z=>asciiUnescapePDF(z[0].slice(1,-1)));txt+=chunks.join('')+' ';}
    txt=txt.replace(/\s+/g,' ').trim();if(!txt)continue;
    const pos=str.match(/(-?\d+(?:\.\d+)?\s+){4}(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/);
    const x=pos?Number(pos[2]):0,y=pos?Number(pos[3]):0;
    parts.push({text:txt,x:Math.round((matrix[0]*x+matrix[2]*y+matrix[4])*10)/10,y:Math.round((matrix[1]*x+matrix[3]*y+matrix[5])*10)/10,fontSize:Number(str.match(/\/F\S+\s+(\d+(?:\.\d+)?)\s+Tf/)?.[1]||9)});
  }
  return parts;
}
function ascii85Decode(input){
 const src=String(input).replace(/^<~/,'').split('~>')[0];const out=[];let group=[];
 for(const ch of src){if(/\s/.test(ch))continue;if(ch==='z'){if(group.length)throw Error('Invalid ASCII85 zero run');out.push(0,0,0,0);continue;}const c=ch.charCodeAt(0);if(c<33||c>117)throw Error('Invalid ASCII85 character');group.push(c-33);
 if(group.length===5){let v=0;for(const x of group)v=v*85+x;out.push(Math.floor(v/16777216)%256,Math.floor(v/65536)%256,Math.floor(v/256)%256,v%256);group=[];}}
 if(group.length){const n=group.length;while(group.length<5)group.push(84);let v=0;for(const x of group)v=v*85+x;const temp=[Math.floor(v/16777216)%256,Math.floor(v/65536)%256,Math.floor(v/256)%256,v%256];out.push(...temp.slice(0,n-1));}
 return Uint8Array.from(out);
}
async function maybeInflate(bytes){
 if(typeof DecompressionStream!=='undefined'){const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
 if(typeof module==='object'&&module.exports)return require('zlib').inflateSync(Buffer.from(bytes));
 throw Error('This browser does not support PDF FlateDecode decompression.');
}
async function readPdf(bytes,file='document.pdf'){
 if(typeof globalThis!=='undefined' && globalThis.GCFAdvancedPDF && globalThis.pdfjsLib) return globalThis.GCFAdvancedPDF.readPdf(bytes,file);

 // Small browser-native fallback for simple searchable PDFs (PDF 1.x, unencrypted, standard text streams).
 // Does not implement PDF.js, custom font CMaps, object streams, scanned images or multi-column layout.
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(await bytes.arrayBuffer());const ascii=(x)=>{if(typeof Buffer!=='undefined'&&typeof module==='object'&&module.exports)return Buffer.from(x).toString('latin1');let out='';for(let j=0;j<x.length;j+=8192)out+=String.fromCharCode(...x.subarray(j,j+8192));return out;};
 const content=ascii(data);if(!content.startsWith('%PDF-'))throw Error('Not a PDF file.');if(/\/Encrypt\b/.test(content))throw Error('Encrypted PDFs are not supported.');
 const objs=new Map();const re=/(\d+)\s+\d+\s+obj\b([\s\S]*?)endobj/g;let m;
 while((m=re.exec(content)))objs.set(+m[1],m[2]);
 const pages=[...objs.entries()].filter(([id,s])=>/\/Type\s*\/Page\b/.test(s)).map(([id,s])=>({id,s}));
 if(!pages.length)throw Error('No readable PDF pages found (object-stream PDFs may require PDF.js).');
 if(pages.length>180)throw Error('For performance, split this PDF into files of at most 180 pages.');
 const lines=[];
 for(let i=0;i<pages.length;i++){
  const page=pages[i].s;const refs=(page.match(/\/Contents\s*\[([\s\S]*?)\]/)?.[1]||page.match(/\/Contents\s+(\d+)\s+\d+\s+R/)?.[0]||'').match(/\d+\s+\d+\s+R/g)||[];
  for(const ref of refs){const id=parseInt(ref,10),obj=objs.get(id);if(!obj)continue;const mark=obj.indexOf('stream');if(mark<0)continue;
   let start=mark+6;if(obj[start]==='\r')start++;if(obj[start]==='\n')start++;
   const end=obj.lastIndexOf('endstream');if(end<0)continue;
   const lenMatch=obj.slice(0,mark).match(/\/Length\s+(\d+)/);const raw=lenMatch?obj.slice(start,start+Number(lenMatch[1])):obj.slice(start,end).replace(/[\r\n]+$/,'');let body=raw;
   if(/\/FlateDecode\b/.test(obj.slice(0,mark))){try{const compressed=/\/ASCII85Decode\b/.test(obj.slice(0,mark))?ascii85Decode(raw):Uint8Array.from(raw,c=>c.charCodeAt(0)&255);body=ascii(await maybeInflate(compressed));}catch(err){throw Error('Unable to decode PDF compressed text stream: '+err.message);}}
   const chunks=textFromPdfStream(body);for(let k=0;k<chunks.length;k++)lines.push({file,page:i+1,location:'Page '+(i+1)+' · Text block '+(k+1),kind:'pdf',text:chunks[k].text,x:chunks[k].x,y:chunks[k].y});
  }
 }
 if(!lines.length)throw Error('No extractable text detected. Scanned, custom-font, or complex PDFs need an OCR/PDF.js processing route.');
 const unseen=[];
 for(let p=1;p<=pages.length;p++)if(!lines.some(line=>line.page===p))unseen.push(p);
 const auditWarnings=unseen.length?[`PARTIAL SCAN: ${unseen.length} of ${pages.length} PDF pages could not be read by the offline reader (pages: ${unseen.join(', ')}). These pages are UNCHECKED. To check them, enable the advanced PDF.js library; results on accessible pages are not a full-document audit.`]:[];
 // Merge same-baseline, separate-cell PDF text into one row, including event details.
 const grouped=[];
 for(let pg=1;pg<=pages.length;pg++){
  const part=lines.filter(x=>x.page===pg);const buckets=[];
  for(const block of part){const bucket=buckets.find(b=>Math.abs(b.y-block.y)<4.5);if(bucket)bucket.blocks.push(block);else buckets.push({y:block.y,blocks:[block]});}
  // Preserve page order and original block numbering; row cells share an identical baseline.
  buckets.sort((a,b)=>b.y-a.y);
  for(const [idx,bucket] of buckets.entries()){
    bucket.blocks.sort((a,b)=>a.x-b.x);
    if(bucket.blocks.length===1)grouped.push({...bucket.blocks[0],parts:bucket.blocks,location:'Page '+pg+' · Text block '+(idx+1)});
    else grouped.push({file,page:pg,location:'Page '+pg+' · Text row '+(idx+1),kind:'pdf-table',text:bucket.blocks.map(z=>z.text).join(' | '),parts:bucket.blocks});
  }
 }
 grouped.auditWarnings=auditWarnings; grouped.pageCount=pages.length; grouped.readPages=pages.length-unseen.length; grouped.ignoredPages=unseen; grouped.isPartial=Boolean(unseen.length); grouped.extractor='Basic offline PDF reader';
 return grouped;
}
function exportCSV(records){const heads=['Source file','Page','Location','Section','Original text','Date as written','Normalized date','Recorded weekday','GCF expected weekday','Status','Discrepancy residue','Signed shift','Validation note'];
 const q=s=>{let t=String(s??'');if(/^[\s]*[=+@]/.test(t))t="'"+t;return /[",\r\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
 return '\uFEFF'+[heads,...records.map(r=>[r.file,r.page,r.location,r.kind,r.sourceText,r.sourceDate,r.date,r.recorded,r.expected,r.status,r.residue,r.shift,r.note])].map(row=>row.map(q).join(',')).join('\r\n');}
return {parseDateValue,scanText,scanSegments,summarize,docxSegmentsFromXml,readDocx,readPdf,exportCSV,MONTHS,DATE_PATTERN};
});
