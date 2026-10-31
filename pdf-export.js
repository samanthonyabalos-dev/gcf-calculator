/* GCF-400 PDF review export. Draws transparent ink on source pages, not just
   /Highlight annotations. The ink is visible in any conforming PDF renderer.
   This adds overlays and a legend; it does NOT replace original page text. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFPdfExport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS={MATCH:[.19,.74,.31],MISMATCH:[.96,.25,.29],REVIEW:[.98,.70,.17],INVALID:[.98,.47,.15],DATE_ONLY:[.32,.62,.92]};
const notes={MATCH:'Recorded and calculated weekdays agree',MISMATCH:'Recorded weekday disagrees',REVIEW:'Source association needs manual review',INVALID:'Invalid Gregorian date',DATE_ONLY:'Standalone date (not an error)'};
function validRect(rect,page){
 if(!rect||!page)return null;
 const size=page.getSize(),r={x0:Number(rect.x0),x1:Number(rect.x1),y0:Number(rect.y0),y1:Number(rect.y1)};
 if(Object.values(r).some(n=>!Number.isFinite(n)))return null;
 const x0=Math.max(0,Math.min(size.width,r.x0)),x1=Math.max(0,Math.min(size.width,r.x1));
 const y0=Math.max(0,Math.min(size.height,r.y0)),y1=Math.max(0,Math.min(size.height,r.y1));
 if(x1-x0<2||y1-y0<3||y1-y0>65||x1-x0>size.width*.94)return null;
 return {x0,x1,y0,y1};
}
async function create(file,records,pdfLib=globalThis.PDFLib){
 if(!pdfLib)throw Error('PDF-lib is not loaded; cannot create highlighted PDF.');
 const data=new Uint8Array(await file.arrayBuffer());
 const doc=await pdfLib.PDFDocument.load(data,{updateMetadata:false});
 const pages=doc.getPages(),unresolved=[],used=new Set(),perStatus=Object.fromEntries(Object.keys(COLORS).map(k=>[k,0]));
 let inkMarks=0,annotationMarks=0,fullyAnnotated=0,partiallyAnnotated=0;
 for(const row of records){
  const page=pages[Number(row.page)-1];
  const given=Array.isArray(row.rects)&&row.rects.length?row.rects:(row.rect?[row.rect]:[]);
  const boxes=given.map(r=>validRect(r,page)).filter(Boolean);
  const required=!!row.recorded&&(['MATCH','MISMATCH'].includes(row.status));
  const missingPosition=!row.hasDatePosition || (required&&!row.hasDayPosition);
  if(!boxes.length||missingPosition){
   unresolved.push(`${row.page||'?'} | ${row.sourceDate||row.date} | ${!boxes.length?'exact positions unavailable':'incomplete date or weekday position'}`);
   if(!boxes.length)continue;
   partiallyAnnotated++;
  }else fullyAnnotated++;
  const rgb=COLORS[row.status]||COLORS.REVIEW;
  const combined=[];
  for(const rect of boxes){
   const unique=[row.page,rect.x0.toFixed(1),rect.y0.toFixed(1),rect.x1.toFixed(1),rect.y1.toFixed(1)].join(':');
   if(used.has(unique))continue;used.add(unique);
   page.drawRectangle({x:rect.x0,y:rect.y0,width:rect.x1-rect.x0,height:rect.y1-rect.y0,color:pdfLib.rgb(...rgb),opacity:.28,borderWidth:0});
   inkMarks++;combined.push(rect);
   try{
    const ctx=doc.context,a=pdfLib.PDFDict.withContext(ctx);
    a.set(pdfLib.PDFName.of('Type'),pdfLib.PDFName.of('Annot'));
    a.set(pdfLib.PDFName.of('Subtype'),pdfLib.PDFName.of('Highlight'));
    a.set(pdfLib.PDFName.of('Rect'),ctx.obj([rect.x0,rect.y0,rect.x1,rect.y1]));
    a.set(pdfLib.PDFName.of('QuadPoints'),ctx.obj([rect.x0,rect.y1,rect.x1,rect.y1,rect.x0,rect.y0,rect.x1,rect.y0]));
    a.set(pdfLib.PDFName.of('C'),ctx.obj(rgb));
    a.set(pdfLib.PDFName.of('CA'),pdfLib.PDFNumber.of(.10));
    a.set(pdfLib.PDFName.of('F'),pdfLib.PDFNumber.of(4)); // Printable PDF annotation.
    const description=[
     'Status: '+(row.status||'REVIEW'),
     'Date checked: '+(row.sourceDate||row.date||'Not available'),
     'Normalized date: '+(row.date||'Not available'),
     'Recorded weekday: '+(row.recorded||'Not printed'),
     'Expected weekday: '+(row.expected||'Not available'),
     'Note: '+(row.note||notes[row.status]||'No additional details')
    ].join('\n');
    a.set(pdfLib.PDFName.of('T'),pdfLib.PDFHexString.fromText('GCF-400 | '+row.status));
    a.set(pdfLib.PDFName.of('Subj'),pdfLib.PDFHexString.fromText('Date and weekday audit'));
    a.set(pdfLib.PDFName.of('Contents'),pdfLib.PDFHexString.fromText(description.slice(0,1200)));
    a.set(pdfLib.PDFName.of('NM'),pdfLib.PDFString.of('gcf-'+row.page+'-'+annotationMarks));
    page.node.addAnnot(ctx.register(a));annotationMarks++;
   }catch(e){/* Visible page ink survives even if PDF annotation dictionaries fail. */}
  }
  if(combined.length)perStatus[row.status]=(perStatus[row.status]||0)+1;
 }
 if(!inkMarks)throw Error('No dates have confidently located highlight boxes; a false annotated PDF will not be exported. See findings CSV.');
 const legend=doc.addPage([612,792]),reg=await doc.embedFont(pdfLib.StandardFonts.Helvetica),bold=await doc.embedFont(pdfLib.StandardFonts.HelveticaBold);
 legend.drawText('GCF-400  |  ANNOTATED DOCUMENT AUDIT',{x:42,y:743,font:bold,size:16,color:pdfLib.rgb(.08,.23,.16)});
 legend.drawText(`Source: ${file.name.replace(/[^\x20-\x7e]/g,'?').slice(0,83)}`,{x:42,y:716,font:reg,size:9});
 let y=665;for(const [status,color] of Object.entries(COLORS)){
  legend.drawRectangle({x:44,y:y-3,width:14,height:14,color:pdfLib.rgb(...color)});
  legend.drawText(`${status}: ${notes[status]} (${perStatus[status]||0})`,{x:69,y,font:reg,size:10,color:pdfLib.rgb(.15,.22,.18)});y-=36;
 }
 legend.drawText(`${records.length} findings  |  ${inkMarks} ink boxes  |  ${unresolved.length} unresolved`,{x:42,y:y-12,font:bold,size:11});
 legend.drawText('Select or hover annotations to see the recorded and expected weekday.',{x:42,y:y-41,font:reg,size:9});
 legend.drawText('Popups depend on your PDF reader; Acrobat or another annotation-capable reader is recommended.',{x:42,y:y-56,font:reg,size:8});
 legend.drawText('A matching weekday does not authenticate the schedule or event.',{x:42,y:y-77,font:reg,size:9});
 const bytes=await doc.save({useObjectStreams:false});
 return {blob:new Blob([bytes],{type:'application/pdf'}),count:inkMarks,fullyAnnotated,partiallyAnnotated,nativeAnnotations:annotationMarks,unresolved,perStatus};
}
return {create,validRect,COLORS};
});
