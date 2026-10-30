/* Page-by-page PDF reader. Requires version-pinned PDF.js and optionally Tesseract.js.
   Every page gets a coverage record; pages not readable fail the completeness gate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFPDF=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LIBS={
 pdf:[['Local','./vendor/pdf.min.js','./vendor/pdf.worker.min.js'],['Cloudflare','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'],['jsDelivr','https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'],['unpkg','https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js','https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js']],
 ocr:[['Local','./vendor/tesseract.min.js'],['jsDelivr','https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'],['unpkg','https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js']],
 write:[['Local','./vendor/pdf-lib.min.js'],['Cloudflare','https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'],['jsDelivr','https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js']]
};
const pending={};
function js(src){return new Promise((resolve,reject)=>{let done=false;const el=document.createElement('script');el.src=src;el.async=true;const timer=setTimeout(()=>finish(Error('Load timed out: '+src)),7000);function finish(e){if(done)return;done=true;clearTimeout(timer);el.onload=el.onerror=null;if(e){el.remove();reject(e);}else resolve();}el.onload=()=>finish();el.onerror=()=>finish(Error('Library unavailable: '+src));document.head.append(el);});}
async function load(which){const field=which==='pdf'?'pdfjsLib':which==='ocr'?'Tesseract':'PDFLib';if(globalThis[field])return {provider:'already loaded'};if(pending[which])return pending[which];pending[which]=(async()=>{let errors=[];for(const entry of LIBS[which]){try{await js(entry[1]);if(globalThis[field]){if(which==='pdf')globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc=entry[2];globalThis['__gcfProvider_'+which]=entry[0];return {provider:entry[0]};}errors.push(entry[0]+': loaded but no global object');}catch(e){errors.push(e.message);}}pending[which]=null;throw Error('Could not load '+which+' engine. Add the missing vendor libraries or allow CDN scripts. '+errors.slice(0,2).join(' | '));})();return pending[which];}
function groupSpans(items,page,file){const raw=[];for(const obj of items||[]){if(!obj.str?.trim()||!obj.transform)continue;const [a,b,c,d,x,y]=obj.transform;const size=Math.max(6,Math.hypot(c,d)||Number(obj.height)||9);const width=Math.max(1,Number(obj.width)||obj.str.length*size*.52);raw.push({text:obj.str.trim(),x,y,width,rect:{x0:x,x1:x+width,y0:y-size*.24,y1:y+size*.84},size});}
 const clusters=[];raw.sort((a,b)=>b.y-a.y||a.x-b.x);
 for(const span of raw){const last=clusters[clusters.length-1],tol=Math.min(8,Math.max(3.5,span.size*.50));
   if(last&&Math.abs(last.y-span.y)<=tol){last.parts.push(span);last.y=(last.y*(last.parts.length-1)+span.y)/last.parts.length;}
   else clusters.push({y:span.y,parts:[span]});}
 return clusters.map((g,i)=>{g.parts.sort((a,b)=>a.x-b.x);const text=g.parts.map(x=>x.text).join(' ').normalize('NFKC').replace(/[\u00a0\u200b-\u200d\ufeff]/g,' ');return {file,page,lineNo:i,location:'Page '+page+' · line '+(i+1),method:'PDF text',text,parts:g.parts,baseline:g.y,confidence:null};}).filter(x=>x.text);
}
async function workerOCR(){await load('ocr');if(!globalThis.__gcfWorker){let settings={logger:()=>{}};if(globalThis.__gcfProvider_ocr==='Local'){settings.workerPath=new URL('vendor/tesseract.worker.min.js',location.href).href;settings.corePath=new URL('vendor/tesseract-core',location.href).href;settings.langPath=new URL('vendor/lang',location.href).href;}globalThis.__gcfWorker=await Tesseract.createWorker('eng',1,settings);}return globalThis.__gcfWorker;}
async function extractOCR(pdfPage,file,pageIndex){const viewport=pdfPage.getViewport({scale:1.55}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);if(canvas.width*canvas.height>18000000)throw Error('Page too large for browser OCR');const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');try{await pdfPage.render({canvasContext:ctx,viewport}).promise;
  let dark=0,total=0;const image=ctx.getImageData(0,0,canvas.width,canvas.height).data,step=Math.max(1,Math.floor(canvas.width*canvas.height/25000));for(let i=0;i<canvas.width*canvas.height;i+=step){const j=i*4;total++;if(Math.min(image[j],image[j+1],image[j+2])<205)dark++;}
  if(dark/Math.max(1,total)<0.00015)return {blank:true,lines:[],confidence:null};
  const worker=await workerOCR(),result=(await worker.recognize(canvas)).data;const words=result.words||result?.blocks?.flatMap(b=>b.paragraphs?.flatMap(p=>p.lines?.flatMap(l=>l.words||[])||[])||[])||[],spans=[];
  for(const word of words){const box=word.bbox||word.boundingBox;if(!box||!word.text?.trim())continue;const a=viewport.convertToPdfPoint(box.x0,box.y0),b=viewport.convertToPdfPoint(box.x1,box.y1),rect={x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),y0:Math.min(a[1],b[1]),y1:Math.max(a[1],b[1])};spans.push({text:word.text.trim(),rect,x:rect.x0,y:(rect.y0+rect.y1)/2,width:rect.x1-rect.x0,confidence:Number(word.confidence)||0});}
  const clusters=[];for(const word of spans){let g=clusters.find(x=>Math.abs(x.y-word.y)<Math.max(3,Math.min(7,(word.rect.y1-word.rect.y0)*.45)));if(!g){g={y:word.y,parts:[]};clusters.push(g);}g.parts.push(word);}
  clusters.sort((a,b)=>b.y-a.y);
  let lines=clusters.map((g,i)=>{g.parts.sort((a,b)=>a.x-b.x);return {file,page:pageIndex,lineNo:i,location:'Page '+pageIndex+' · OCR line '+(i+1),method:'OCR',text:g.parts.map(p=>p.text).join(' '),parts:g.parts,baseline:g.y,confidence:g.parts.reduce((s,w)=>s+w.confidence,0)/g.parts.length};});
  // Prefer line boxes when the OCR engine reports lines but omits word boxes.
  if(!lines.length&&result.lines?.length){lines=result.lines.filter(l=>l.text?.trim()).map((l,i)=>{
    const box=l.bbox||l.boundingBox, parts=[];
    if(box){const a=viewport.convertToPdfPoint(box.x0,box.y0),b=viewport.convertToPdfPoint(box.x1,box.y1);
      const rect={x0:Math.min(a[0],b[0]),y0:Math.min(a[1],b[1]),x1:Math.max(a[0],b[0]),y1:Math.max(a[1],b[1])};
      parts.push({text:l.text.trim(),rect,x:rect.x0,y:(rect.y0+rect.y1)/2,width:rect.x1-rect.x0,confidence:Number(l.confidence)||0});}
    return {file,page:pageIndex,lineNo:i,location:'Page '+pageIndex+' · OCR line '+(i+1),method:'OCR',text:l.text.trim(),parts,confidence:Number(l.confidence)||0};
  });}
  // Text-only fallback supports CSV reporting, but never invents highlight coordinates.
  if(!lines.length&&result.text){lines=result.text.split(/\r?\n/).filter(x=>x.trim()).map((text,i)=>({file,page:pageIndex,lineNo:i,location:'Page '+pageIndex+' · OCR text '+(i+1),method:'OCR',text,parts:[],confidence:result.confidence||null}));}
  return {blank:false,lines,confidence:Number(result.confidence)||0};
 }finally{canvas.width=canvas.height=0;}}
function needsOCR(mode,native,reading='auto'){
 const nativeText=native.map(x=>x.text).join(' '),textLen=nativeText.trim().length;
 const findings=globalThis.GCFScanner?.scanPage(native,{reading})||[];
 const paired=findings.filter(r=>r.status==='MATCH'||r.status==='MISMATCH').length;
 const uncertain=findings.filter(r=>r.status==='REVIEW').length;
 const lone=findings.filter(r=>r.status==='DATE_ONLY').length;
 // Native text is preferred. Standalone title/footer dates do NOT cause OCR.
 // OCR rescues empty/garbled text or ambiguous schedule lines only.
 const garbled=textLen>0&&((nativeText.match(/[\uFFFD\u25A1]/g)||[]).length>4);
 // A readable text layer may omit the weekday glyphs of an examination
 // schedule. Recheck a date-only, schedule-like page with OCR when no printed
 // weekday/date pair survived extraction; do not OCR ordinary date mentions.
 const scheduleWithoutPairs=lone>0&&paired===0&&/\b(?:date\s*(?:and|&)\s*time|exam(?:ination)?\s*schedule|schedule\s+of|date\s+of\s+exam|board\s+exam|written\s+exam|practical\s+exam)\b/i.test(nativeText);
 return {needed:mode==='all'||(mode==='auto'&&(textLen<50||garbled||(uncertain>0&&paired===0&&reading==='auto')||scheduleWithoutPairs)),
   missingDays:lone,knownPairs:paired,reason:textLen<50?'Insufficient native text':garbled?'Corrupted text layer':scheduleWithoutPairs?'Schedule dates lack a readable weekday':uncertain>0?'Uncertain weekday association':'Native text is usable'};
}
async function readPdf(file,{ocr='auto',reading='auto',order='auto',onProgress=()=>{},shouldStop=()=>false}={}){
 await load('pdf');const bytes=new Uint8Array(await file.arrayBuffer());const job=pdfjsLib.getDocument({data:bytes.slice(),useSystemFonts:true,isEvalSupported:false}),doc=await job.promise;if(doc.numPages>180)throw Error('PDF over 180 pages; split it into smaller files');
 const coverage=[],lines=[];try{for(let i=1;i<=doc.numPages;i++){if(shouldStop())throw Error('Scan canceled by user.');const details={file:file.name,page:i,method:'',nativeLines:0,ocrAttempted:false,ocrLines:0,ocrConfidence:'',status:'',note:''};let pg=null,native=[],recognized=null;onProgress(i,doc.numPages,'Decoding');try{pg=await doc.getPage(i);const content=await pg.getTextContent({disableCombineTextItems:false});native=groupSpans(content.items,i,file.name);}catch(e){details.note+='Text layer: '+e.message+'; ';}
   details.nativeLines=native.length;
   const ocrCheck=needsOCR(ocr,native,reading),need=ocrCheck.needed,missingDays=ocrCheck.missingDays;
   if(need)details.note+='Reason for OCR: '+ocrCheck.reason+'; ';
   if(need){details.ocrAttempted=true;onProgress(i,doc.numPages,'OCR');if(shouldStop())throw Error('Scan canceled by user.');try{if(!pg)pg=await doc.getPage(i);recognized=await extractOCR(pg,file.name,i);details.ocrLines=recognized.lines.length;details.ocrConfidence=recognized.confidence??'';}catch(e){details.note+='OCR: '+e.message+'; ';}}
   const nativePairs=globalThis.GCFScanner?.scanPage(native,{reading,order}).filter(x=>x.status==='MATCH'||x.status==='MISMATCH').length||0,ocrPairs=recognized?.lines?.length?(GCFScanner.scanPage(recognized.lines,{reading,order}).filter(x=>x.status==='MATCH'||x.status==='MISMATCH').length):0;
   let picked=native,method='Text layer';if(ocr==='all'){picked=recognized?.lines||[];method='OCR only';}else if(recognized?.lines?.length&&(!native.length||ocrPairs>nativePairs)){picked=recognized.lines;method='OCR';}
   if(ocr==='all'&&need&&!recognized){details.status='UNREADABLE';details.method='OCR required but failed';}
   else if(!picked.length&&recognized?.blank){details.status='BLANK';details.method='Verified visually blank';}
   else if(!picked.length){details.status='UNREADABLE';details.method='Unverified';if(ocr==='all')details.note+='OCR generated no positioned text; cannot certify or highlight this page. ';}
   else {details.status='READABLE';details.method=method;lines.push(...picked);}
   coverage.push(details);if(pg)pg.cleanup();onProgress(i,doc.numPages,details.status);
 }}finally{await doc.destroy();}
 return {file:file.name,lines,coverage,pageCount:coverage.length,complete:coverage.every(x=>x.status!=='UNREADABLE'),unchecked:coverage.filter(x=>x.status==='UNREADABLE')};
}
async function closeOCR(){if(globalThis.__gcfWorker){await globalThis.__gcfWorker.terminate();globalThis.__gcfWorker=null;}}
// Render an original PDF page inside the audit panel. Highlights are drawn as
// positioned HTML overlays, so hovering/clicking a result selects its source.
let previewCache=null,previewQueue=Promise.resolve();
async function renderPreview(file,pageNo,canvas){
 await load('pdf');
 if(!previewCache||previewCache.file!==file){
  if(previewCache?.pdf)await previewCache.pdf.destroy();
  const bytes=new Uint8Array(await file.arrayBuffer());
  previewCache={file,pdf:await pdfjsLib.getDocument({data:bytes.slice(),useSystemFonts:true,isEvalSupported:false}).promise};
 }
 const page=await previewCache.pdf.getPage(pageNo),base=page.getViewport({scale:1});
 const available=(canvas.closest('.pdf-scroll')?.clientWidth||780)-24;const width=Math.min(820,Math.max(180,available));
 const viewport=page.getViewport({scale:width/base.width});
 const ratio=Math.min(2,globalThis.devicePixelRatio||1),ctx=canvas.getContext('2d');
 canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
 canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
 await page.render({canvasContext:ctx,viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;
 page.cleanup();return viewport;
}
function previewPage(file,pageNo,canvas){previewQueue=previewQueue.catch(()=>{}).then(()=>renderPreview(file,pageNo,canvas));return previewQueue;}
async function closePreview(){await previewQueue.catch(()=>{});if(previewCache?.pdf)await previewCache.pdf.destroy();previewCache=null;}
return {load,readPdf,groupSpans,needsOCR,closeOCR,previewPage,closePreview};
});
