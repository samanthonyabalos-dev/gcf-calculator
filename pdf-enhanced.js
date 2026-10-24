/* Advanced searchable-PDF extraction/export for current PRC-style PDFs.
   Uses PDF.js to interpret object streams, xref streams and font maps;
   uses pdf-lib to add real PDF annotations to a NEW copy. No document upload.
   CDN libraries are loaded by index.html; this module fails clearly if unavailable.
*/
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFAdvancedPDF=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const labels={MATCH:{color:[.22,.70,.34],name:'MATCH — recorded weekday consistent'},MISMATCH:{color:[.93,.24,.29],name:'MISMATCH — weekday disagrees'},INVALID:{color:[.96,.55,.15],name:'INVALID — impossible Gregorian date'},REVIEW:{color:[.97,.78,.12],name:'REVIEW — uncertain date or weekday'},NO_WEEKDAY:{color:[.33,.65,.9],name:'NO WEEKDAY — date without weekday'}};
const pdfJs=()=>globalThis.pdfjsLib;
const pdfLib=()=>globalThis.PDFLib;
function getPdfJs(){if(!pdfJs())throw Error('Advanced PDF reader unavailable. PDF.js did not load from the online library. Connect to the internet, allow scripts from cdnjs.cloudflare.com, and refresh. Your PDF was not scanned.');return pdfJs();}
const eps=2.8;
function buildLines(items,file,pageNo){
 const spans=[];
 for(const el of items){if(typeof el.str!=='string'||!el.str.trim()||!Array.isArray(el.transform))continue;
  const t=el.transform,x=Number(t[4]),y=Number(t[5]);const size=Math.max(5,Math.hypot(t[2],t[3])||Number(el.height)||9);
  if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  const width=Math.max(1,Number(el.width)||el.str.length*size*.45);
  spans.push({text:el.str.replace(/\s+/g,' ').trim(),x,y,width,fontSize:size,pdfRect:{x0:x,x1:x+width,y0:y-size*.20,y1:y+size*.88}});
 }
 const buckets=[];
 for(const sp of spans){let b=buckets.find(o=>Math.abs(o.y-sp.y)<Math.min(4.5,Math.max(eps,sp.fontSize*.32)));if(!b){b={y:sp.y,parts:[]};buckets.push(b);}b.parts.push(sp);}
 buckets.sort((a,b)=>b.y-a.y);
 const lines=[];
 buckets.forEach((b,i)=>{b.parts.sort((a,b)=>a.x-b.x);let text='';let end=null;
  const pdfParts=[];
  for(const p of b.parts){const gap=end===null?0:p.x-end;const sep=text?(gap>Math.max(13,p.fontSize*1.5)?' | ':' '):'';
   text+=sep+p.text;
   pdfParts.push({...p,separator:sep});end=p.x+p.width;}
  if(text.trim())lines.push({file,page:pageNo,location:`Page ${pageNo} · Line ${i+1}`,kind:'pdf',text,parts:pdfParts});
 });
 return lines;
}
async function readPdf(fileOrBytes,file='document.pdf'){
 const pdfjs=getPdfJs();pdfjs.GlobalWorkerOptions.workerSrc=(globalThis.__gcfLocalPdf?'./vendor/pdf.worker.min.js':'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
 const data=fileOrBytes instanceof Uint8Array?fileOrBytes:new Uint8Array(await fileOrBytes.arrayBuffer());
 if(data.length>25*1024*1024)throw Error('PDF exceeds 25 MB. Split it before scanning.');
 const job=pdfjs.getDocument({data:data.slice(),useSystemFonts:true,isEvalSupported:false});
 let pdf;try{pdf=await job.promise;}catch(e){throw Error('PDF.js could not open the document: '+(e?.message||e));}
 if(pdf.numPages>180){await pdf.destroy();throw Error('PDF exceeds 180 pages. Split the file into smaller parts.');}
 const pageCount=pdf.numPages;const segments=[];const warnings=[],unreadablePages=[];
 try{for(let n=1;n<=pdf.numPages;n++){
  let page,content;
  try{page=await pdf.getPage(n);content=await page.getTextContent({disableCombineTextItems:false,includeMarkedContent:false});}
  catch(err){warnings.push(`Page ${n}: text extraction failed (${err?.message||err})`);unreadablePages.push(n);continue;}
  const lines=buildLines(content.items,file,n);
  if(lines.length===0){warnings.push(`Page ${n}: no searchable text; could be scanned`);unreadablePages.push(n);}
  segments.push(...lines);
  page.cleanup();
 }} finally{await pdf.destroy();}
 if(!segments.length)throw Error('No searchable PDF text was extracted. Image-only/scanned pages require OCR, which is not installed.');
 // Never silently classify a partially read document as completely audited.
 segments.auditWarnings=warnings;segments.pageCount=pageCount;segments.readPages=pageCount-unreadablePages.length;segments.ignoredPages=unreadablePages;segments.isPartial=Boolean(unreadablePages.length);segments.extractor='PDF.js';
 return segments;
}
function position(record){
 if(!record.page||!record.pdfParts||!record.sourceDate)return null;
 const parts=record.pdfParts;const matches=[];
 for(let i=0;i<parts.length;i++){
  const p=parts[i];let at=-1;while((at=p.text.toLowerCase().indexOf(record.sourceDate.toLowerCase(),at+1))>=0)matches.push({p,at});
 }
 if(matches.length===1){const {p,at}=matches[0];
  const width=p.width,full=p.text,sub=record.sourceDate;
  // More precise than assuming a fixed Arial font width: use the PDF.js item width.
  let prefixWidth=at/full.length*width,subWidth=sub.length/full.length*width;
  if(typeof document!=='undefined'){
   const ctx=document.createElement('canvas').getContext('2d');ctx.font=`${p.fontSize||10}px sans-serif`;
   const all=ctx.measureText(full).width;
   if(all>0){prefixWidth=width*ctx.measureText(full.slice(0,at)).width/all;subWidth=width*ctx.measureText(sub).width/all;}
  }
  if(!p.pdfRect)return null;
  const x0=p.x+prefixWidth-.75,x1=p.x+prefixWidth+subWidth+.75;
  const y0=p.pdfRect.y0,y1=p.pdfRect.y1;
  if(![x0,x1,y0,y1].every(Number.isFinite)||x1<=x0)return null;
  return {x0,x1,y0,y1,page:record.page};
 }
 // Page text may span two adjacent PDF text items; only accept a unique short contiguous match.
 const join=parts.map(p=>p.text).join(' ');
 const at=join.toLowerCase().indexOf(record.sourceDate.toLowerCase());
 if(at<0||join.toLowerCase().indexOf(record.sourceDate.toLowerCase(),at+1)>=0)return null;
 let from=-1,to=-1,pos=0;
 for(let i=0;i<parts.length;i++){
  const start=pos,end=start+parts[i].text.length;
  if(from<0&&at<end)from=i;
  if(at+record.sourceDate.length-1>=start&&at+record.sourceDate.length-1<end){to=i;break;}
  pos=end+1;
 }
 if(from<0||to<0||to-from>2)return null;
 const p=parts[from],q=parts[to];if(Math.abs(p.y-q.y)>4.5||q.x-(p.x+p.width)>26)return null;
 const x0=p.x+Math.max(0,at-join.indexOf(p.text))*p.width/Math.max(p.text.length,1)-.8;
 const endOffset=(at+record.sourceDate.length-1)-join.indexOf(q.text);
 const x1=q.x+Math.min(q.width,q.width*(endOffset+1)/Math.max(q.text.length,1))+.8;
 return {x0,x1,y0:Math.min(p.pdfRect.y0,q.pdfRect.y0),y1:Math.max(p.pdfRect.y1,q.pdfRect.y1),page:record.page};
}
async function annotatePdf(file,rows,includeMatches=false){
 const L=pdfLib();if(!L)throw Error('Advanced PDF annotation engine unavailable. PDF-lib did not load from cdnjs.cloudflare.com. Connect to the internet, allow the script, and refresh.');
 const source=new Uint8Array(await file.arrayBuffer());
 let doc;try{doc=await L.PDFDocument.load(source,{updateMetadata:false});}catch(e){throw Error('Unable to open PDF for native annotations: '+(e?.message||e));}
 const pages=doc.getPages();const unresolved=[];let placed=0;const used=new Set();const tally=Object.fromEntries(Object.keys(labels).map(k=>[k,0]));
 for(let k=0;k<rows.length;k++){
  const r=rows[k];tally[r.status]=(tally[r.status]||0)+1;if(!includeMatches&&r.status==='MATCH')continue;
  const rect=position(r);if(!rect||rect.page<1||rect.page>pages.length){unresolved.push({record:k+1,date:r.sourceDate,location:r.location,reason:'Exact highlight location unavailable'});continue;}
  const key=`${rect.page}:${rect.x0.toFixed(1)}:${rect.y0.toFixed(1)}:${rect.x1.toFixed(1)}`;
  if(used.has(key)){unresolved.push({record:k+1,date:r.sourceDate,location:r.location,reason:'Duplicate highlight location'});continue;}
  used.add(key);
  try{
   const color=labels[r.status]?.color||labels.REVIEW.color;
   const page=pages[rect.page-1];
   const annotation=L.PDFDict.withContext(doc.context);
   annotation.set(L.PDFName.of('Type'),L.PDFName.of('Annot'));
   annotation.set(L.PDFName.of('Subtype'),L.PDFName.of('Highlight'));
   annotation.set(L.PDFName.of('Rect'),doc.context.obj([rect.x0,rect.y0,rect.x1,rect.y1]));
   annotation.set(L.PDFName.of('QuadPoints'),doc.context.obj([rect.x0,rect.y1,rect.x1,rect.y1,rect.x0,rect.y0,rect.x1,rect.y0]));
   annotation.set(L.PDFName.of('C'),doc.context.obj(color));
   annotation.set(L.PDFName.of('CA'),L.PDFNumber.of(.40));
   annotation.set(L.PDFName.of('F'),L.PDFNumber.of(4));
   annotation.set(L.PDFName.of('Contents'),L.PDFString.of(`GCF-400 ${r.status}: ${r.sourceDate}; expected ${r.expected||'—'}`));
   page.node.addAnnot(doc.context.register(annotation));
   placed++;
  }catch(err){unresolved.push({record:k+1,date:r.sourceDate,location:r.location,reason:'Annotation engine error: '+(err?.message||err)});}
 }
 // Preserve source page contents; append all added information to a separate legend page.
 const page=doc.addPage([612,792]);const regular=await doc.embedFont(L.StandardFonts.Helvetica),bold=await doc.embedFont(L.StandardFonts.HelveticaBold);
 const rgb=L.rgb;
 page.drawText('GCF-400 | DOCUMENT AUDIT LEGEND',{x:45,y:742,font:bold,size:16,color:rgb(.09,.24,.16)});
 page.drawText('Highlights indicate date/weekday consistency; they do not authenticate events.',{x:45,y:714,font:regular,size:9});
 let y=676;
 for(const [status,entry] of Object.entries(labels)){
  page.drawRectangle({x:47,y:y-3,width:14,height:14,color:rgb(...entry.color)});
  page.drawText(`${entry.name}  (${tally[status]||0})`,{x:74,y,font:regular,size:10,color:rgb(.16,.2,.17)});y-=34;
 }
 page.drawText(`${rows.length} findings | ${placed} highlights | ${unresolved.length} unresolved anchors`,{x:45,y:y-8,font:bold,size:11});
 page.drawText('Original document pages and text have not been intentionally rewritten.',{x:45,y:y-40,font:regular,size:9});
 page.drawText('Unresolved matches require manual review using the exported findings CSV.',{x:45,y:y-58,font:regular,size:9});
 const bytes=await doc.save({useObjectStreams:false});
 return {blob:new Blob([bytes],{type:'application/pdf'}),summary:{source:file.name,format:'pdf',total:rows.length,counts:tally,highlighted:placed,unresolved:unresolved.length,issues:unresolved}};
}
return {readPdf,annotatePdf,position,buildLines};
});
