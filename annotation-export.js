/* GCF-400 local annotated-document exporter.
   Native DOCX w:highlight; incremental PDF 1.x highlight annotations and legend.
   Safety: unsupported positioning is recorded as unresolved, never guessed.
   Source file bytes are never modified. No network access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFAnnotations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LEGEND={MATCH:{hex:[.22,.70,.34],word:'green',meaning:'Consistent Gregorian weekday'},MISMATCH:{hex:[.93,.24,.29],word:'red',meaning:'Recorded weekday disagrees'},INVALID:{hex:[.96,.55,.15],word:'darkYellow',meaning:'Invalid Gregorian date'},REVIEW:{hex:[.97,.78,.12],word:'yellow',meaning:'Ambiguous; check source'},NO_WEEKDAY:{hex:[.33,.65,.9],word:'cyan',meaning:'No associated recorded weekday'}};
const STATUSES=Object.keys(LEGEND);
const escPdf=(s)=>String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7e]/g,'?').slice(0,250);
const escXML=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rgb=(color)=>color.map(x=>x.toFixed(3)).join(' ');
const counts=(rows)=>Object.fromEntries(STATUSES.map(s=>[s,rows.filter(r=>r.status===s).length]));
const includeRow=(r,includeMatches)=>includeMatches||r.status!=='MATCH';
function summary(file,rows,placed,issues,format){return {source:file.name||file,format,total:rows.length,counts:counts(rows),highlighted:placed,unresolved:issues.length,issues};}
function textMetrics(text,size){if(typeof document!=='undefined'){const ctx=document.createElement('canvas').getContext('2d');ctx.font=size+'px Arial';return ctx.measureText(text).width;}return text.length*size*.48;}
function getPosition(row){
 if(!row.page ||!row.pdfParts || !row.sourceDate)return null;
 const hits=[];
 for(const part of row.pdfParts){let start=-1;while((start=part.text.indexOf(row.sourceDate,start+1))>=0){hits.push({part,start});}}
 if(hits.length!==1)return null;const {part,start}=hits[0];const size=part.fontSize||9;
 // An intentionally conservative annotation; only single-line searchable text is supported.
 if(!Number.isFinite(part.x)||!Number.isFinite(part.y)||!Number.isFinite(size)||size<5||size>36)return null;
 const x0=part.x+textMetrics(part.text.slice(0,start),size);
 const x1=x0+textMetrics(row.sourceDate,size);
 if(!(x1>x0) || x0<0||x1>1500||part.y<0||part.y>2000)return null;
 return {x0:Math.max(0,x0-1.2),x1:x1+1.2,y0:part.y-2,y1:part.y+size*1.13,page:row.page};
}
function appendPDF(input,rows,includeMatches=false){
 const decoder=new TextDecoder('latin1');const text=decoder.decode(input);
 if(!text.startsWith('%PDF-'))throw Error('Not a PDF.');
 if(/\/Encrypt\b|\/ObjStm\b|\/Type\s*\/XRef\b/.test(text))throw Error('PDF encryption or object-stream/xref-stream layout is not supported for annotations.');
 const tail=text.slice(-12000),oldXref=Number([...text.matchAll(/startxref\s+(\d+)/g)].at(-1)?.[1]);
 if(!Number.isSafeInteger(oldXref)||!text.slice(oldXref,oldXref+4).startsWith('xref'))throw Error('Only classic-xref PDF 1.x exports are currently supported.');
 const rootRef=tail.match(/\/Root\s+(\d+)\s+0\s+R/);
 if(!rootRef)throw Error('PDF root dictionary not available.');
 const obj=new Map();for(const m of text.matchAll(/(?:^|[\r\n])(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g))obj.set(+m[1],m[2].trim());
 const root=obj.get(+rootRef[1]);const pagesId=Number(root?.match(/\/Pages\s+(\d+)\s+0\s+R/)?.[1]);
 const pagesRoot=obj.get(pagesId);if(!pagesRoot||!(/\/Kids\s*\[/.test(pagesRoot)))throw Error('Unsupported PDF page tree for embedded legend.');
 const pageIds=[...obj.entries()].filter(([_,body])=>/\/Type\s*\/Page\b/.test(body)).map(([id,body])=>({id,body}));
 // The existing scanner enumerates page objects in file order. If that differs
 // from the actual page tree, refuse positional annotation instead of marking
 // a different document page.
 function walkPages(id,visited=new Set()){
   if(visited.has(id))throw Error('Cyclic PDF page tree');visited.add(id);
   const body=obj.get(id)||'';
   if(/\/Type\s*\/Page\b/.test(body))return [id];
   const kids=body.match(/\/Kids\s*\[([\s\S]*?)\]/);
   if(!kids)throw Error('Unsupported PDF page tree /Kids');
   return [...kids[1].matchAll(/(\d+)\s+0\s+R/g)].flatMap(m=>walkPages(Number(m[1]),visited));
 }
 const actualOrder=walkPages(pagesId);
 if(actualOrder.join(',')!==pageIds.map(p=>p.id).join(','))throw Error('PDF page order differs from the scanner extraction order; accurate annotations cannot be assured.');
 if(pageIds.some(p=>/\/Rotate\s+(?!0\b)\d+/.test(p.body)))throw Error('Rotated PDF pages require a separate annotation coordinate transform.');
 if(pageIds.some(p=>/\/CropBox\s*\[/.test(p.body)))throw Error('PDF CropBox coordinates not supported for precise annotation.');
 if(pageIds.some(p=>/\/Annots\s+\d+\s+0\s+R/.test(p.body)))throw Error('PDF has indirect annotation arrays; source highlights are unsupported in this document.');
 const fileName=String(rows[0]?.file||'document.pdf');
 const maxId=Math.max(...obj.keys());let idCounter=maxId+1;const updates=new Map();const byPage=new Map(),issues=[],used=new Set();let placed=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i];if(!includeRow(r,includeMatches))continue;
  const geom=getPosition(r);if(!geom){issues.push({record:i+1,date:r.sourceDate,location:r.location,reason:'Exact single-line date anchor not confidently located'});continue;}
  const item=pageIds[geom.page-1];if(!item){issues.push({record:i+1,date:r.sourceDate,location:r.location,reason:'Page index not found'});continue;}
  const key=geom.page+':'+[geom.x0,geom.y0,geom.x1,geom.y1].map(n=>n.toFixed(1)).join(':');
  if(used.has(key)){issues.push({record:i+1,date:r.sourceDate,location:r.location,reason:'Duplicate date anchor'});continue;}used.add(key);
  const aId=idCounter++;
  const nums=[geom.x0,geom.y0,geom.x1,geom.y1].map(n=>n.toFixed(2));
  const quad=[nums[0],nums[3],nums[2],nums[3],nums[0],nums[1],nums[2],nums[1]].join(' ');
  const color=LEGEND[r.status]||LEGEND.REVIEW;
  updates.set(aId,`<< /Type /Annot /Subtype /Highlight /P ${item.id} 0 R /Rect [${nums.join(' ')}] /QuadPoints [${quad}] /C [${rgb(color.hex)}] /CA 0.38 /F 4 /T (GCF-400 Audit) /Contents (${escPdf(r.status+' | '+r.sourceDate+' | recorded: '+(r.recorded||'-')+' | expected: '+(r.expected||'-')+' | '+r.location)}) >>`);
  if(!byPage.has(item.id))byPage.set(item.id,[]);byPage.get(item.id).push(aId);placed++;
 }
 for(const item of pageIds){const ann=byPage.get(item.id);if(!ann?.length)continue;
  let pageDict=item.body;
  const had=pageDict.match(/\/Annots\s*(\[[^\]]*\]|\d+\s+0\s+R)/);
  if(had){if(!had[1].startsWith('[')){for(const id of ann)updates.delete(id); placed-=ann.length;for(const r of rows.filter(x=>x.page===pageIds.indexOf(item)+1&&includeRow(x,includeMatches)))issues.push({date:r.sourceDate,location:r.location,reason:'Existing indirect annotation array unsupported'});continue;}
    pageDict=pageDict.replace(had[0],'/Annots ['+had[1].slice(1,-1)+' '+ann.map(id=>id+' 0 R').join(' ')+']');
  }else pageDict=pageDict.replace(/>>\s*$/,'/Annots ['+ann.map(id=>id+' 0 R').join(' ')+'] >>');
  updates.set(item.id,pageDict);
 }
 const fontId=idCounter++,contentId=idCounter++,legendId=idCounter++;
 const actual=counts(rows),yStart=722;
 const draw=['q','0.09 0.24 0.16 rg','BT /GFCA 17 Tf 45 747 Td (GCF-400  |  DOCUMENT AUDIT LEGEND) Tj ET','Q','BT /GFCA 9 Tf 45 724 Td (Colored annotations mark source dates, not proof that the event information is authentic.) Tj ET'];
 let yy=678;
 for(const status of STATUSES){const color=LEGEND[status];draw.push(`${rgb(color.hex)} rg 46 ${yy-4} 15 14 re f`,'0.15 0.20 0.17 rg',`BT /GFCA 11 Tf 76 ${yy} Td (${status}  |  ${actual[status]}  |  ${escPdf(color.meaning)}) Tj ET`);yy-=35;}
 draw.push(`BT /GFCA 10 Tf 45 ${yy-6} Td (${rows.length} findings  |  ${placed} highlighted  |  ${issues.length} unresolved anchors) Tj ET`);
 draw.push(`BT /GFCA 9 Tf 45 ${yy-38} Td (Default: only flagged or uncertain records highlighted. Source pages unchanged.) Tj ET`);
 draw.push(`BT /GFCA 9 Tf 45 ${yy-57} Td (Unresolved positions are recorded in the companion CSV report.) Tj ET`);
 updates.set(fontId,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const stream=draw.join('\n')+'\n';updates.set(contentId,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
 updates.set(legendId,`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /GFCA ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
 const oldKids=pagesRoot.match(/\/Kids\s*\[([\s\S]*?)\]/);const oldCount=pagesRoot.match(/\/Count\s+(\d+)/);
 if(!oldKids||!oldCount)throw Error('Cannot append PDF legend with this page tree.');
 const newTree=pagesRoot.replace(oldKids[0],'/Kids ['+oldKids[1].trim()+' '+legendId+' 0 R]').replace(oldCount[0],'/Count '+(Number(oldCount[1])+1));updates.set(pagesId,newTree);
 const originalSize=Number([...tail.matchAll(/\/Size\s+(\d+)/g)].at(-1)?.[1]);const newSize=Math.max(originalSize||0,idCounter);
 let added='\n';const offsets=new Map();const encoder=new TextEncoder();let countBytes=input.length;
 const put=(str)=>{added+=str;countBytes+=encoder.encode(str).length;};
 for(const [id,body] of [...updates.entries()].sort((a,b)=>a[0]-b[0])){offsets.set(id,countBytes);put(`${id} 0 obj\n${body}\nendobj\n`);}
 const xrefOffset=countBytes;put('xref\n');for(const [id,offset] of [...offsets.entries()].sort((a,b)=>a[0]-b[0])){put(`${id} 1\n${String(offset).padStart(10,'0')} 00000 n \n`);}
 put(`trailer\n<< /Size ${newSize} /Root ${rootRef[1]} 0 R /Prev ${oldXref} >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
 const merged=new Uint8Array(input.length+encoder.encode(added).length);merged.set(input);merged.set(encoder.encode(added),input.length);
 return {blob:new Blob([merged],{type:'application/pdf'}),summary:summary({name:fileName},rows,placed,issues,'pdf')};
}
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function direct(el,name){return [...el.children].find(x=>x.localName===name&&x.namespaceURI===W)||null;}
function descendants(el,name){return [...el.getElementsByTagNameNS(W,name)];}
function paragraphsInBody(body){return [...body.children].filter(x=>x.localName==='p'&&x.namespaceURI===W);}
function cellParagraphs(el){return descendants(el,'p');}
function findDocxTarget(doc,row){
 const body=descendants(doc.documentElement,'body')[0];if(!body)return [];
 let m=String(row.location||'').match(/^Paragraph (\d+)$/);
 if(m){const list=paragraphsInBody(body);return list[+m[1]-1]?[list[+m[1]-1]]:[];}
 m=String(row.location||'').match(/^Table row (\d+)$/);
 if(m){const tableRows=descendants(body,'tr');const tr=tableRows[+m[1]-1];return tr?cellParagraphs(tr):[];}
 return [];
}
function splitHighlight(textNodes,raw,color,doc){
 const text=textNodes.map(x=>x.textContent).join('');const first=text.indexOf(raw);
 if(first<0)return 'Date string not present in mapped paragraph';
 if(text.indexOf(raw,first+1)>=0)return 'Date string repeats in this paragraph; ambiguous anchor';
 const end=first+raw.length;let checkPos=0;
 for(const node of textNodes){
   const start=checkPos,stop=start+node.textContent.length;checkPos=stop;
   if(Math.min(end,stop)<=Math.max(first,start))continue;
   let owner=node.parentElement;while(owner&&owner.localName!=='r')owner=owner.parentElement;
   if(!owner||descendants(owner,'t').length!==1||[...owner.children].some(x=>!['rPr','t'].includes(x.localName)))return 'Unsupported complex Word run';
 }
 let pos=0;
 for(const node of textNodes){const val=node.textContent,start=pos,stop=pos+val.length;pos=stop;
  const a=Math.max(first,start)-start,b=Math.min(end,stop)-start;
  if(b<=a)continue;
  const run=node.closest?node.closest('w\\:r'):null;
  // Native document.xml structure: w:r is the direct parent of w:t for standard documents.
  let owner=node.parentElement;while(owner&&owner.localName!=='r')owner=owner.parentElement;
  if(!owner || !owner.parentNode)return 'Unsupported DOCX run nesting';
  const parent=owner.parentNode;
  const pieces=[];
  if(a>0)pieces.push({txt:val.slice(0,a),mark:false});
  pieces.push({txt:val.slice(a,b),mark:true});
  if(b<val.length)pieces.push({txt:val.slice(b),mark:false});
  if(pieces.length===1){let pr=direct(owner,'rPr');if(!pr){pr=doc.createElementNS(W,'w:rPr');owner.insertBefore(pr,owner.firstChild);}
    for(const n of [...pr.children])if(n.localName==='highlight'&&n.namespaceURI===W)pr.removeChild(n);
    const h=doc.createElementNS(W,'w:highlight');h.setAttributeNS(W,'w:val',color);pr.appendChild(h);continue;}
  // Split simple runs only; refuse runs containing drawing, fields or extra text objects.
  if(descendants(owner,'t').length!==1 || [...owner.children].some(x=>!['rPr','t'].includes(x.localName)))return 'Complex run; unable to split without modifying formatting';
  let pivot=owner;
  for(const part of pieces){const cloned=owner.cloneNode(true);const t=descendants(cloned,'t')[0];t.textContent=part.txt;
    if(/^\s|\s$/.test(part.txt))t.setAttribute('xml:space','preserve');
    let pr=direct(cloned,'rPr');if(!pr){pr=doc.createElementNS(W,'w:rPr');cloned.insertBefore(pr,cloned.firstChild);}
    // Preserve the author's existing highlight on text outside the audit target.
    // Only the target date receives the GCF status color.
    if(part.mark){
      for(const h of [...pr.children])if(h.localName==='highlight')pr.removeChild(h);
      const h=doc.createElementNS(W,'w:highlight');h.setAttributeNS(W,'w:val',color);pr.appendChild(h);
    }
    parent.insertBefore(cloned,pivot.nextSibling);pivot=cloned;
  }
  parent.removeChild(owner);
 }
 return null;
}
function annotateDOCXXml(xml,rows,includeMatches=false){
 const parser=new DOMParser(),doc=parser.parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Invalid Word XML.');
 const issues=[];let placed=0,used=new Set();
 rows.forEach((r,i)=>{if(!includeRow(r,includeMatches))return;
  const candidates=findDocxTarget(doc,r);const matched=candidates.filter(p=>descendants(p,'t').map(t=>t.textContent).join('').includes(r.sourceDate));
  if(matched.length!==1){issues.push({record:i+1,date:r.sourceDate,location:r.location,reason:matched.length?'Ambiguous anchor across multiple paragraphs':'Date string not found in original document'});return;}
  const p=matched[0],key=r.location+'|'+r.sourceDate;
  if(used.has(key)){issues.push({record:i+1,date:r.sourceDate,location:r.location,reason:'Duplicate anchor'});return;}
  const result=splitHighlight(descendants(p,'t'),r.sourceDate,LEGEND[r.status]?.word||'yellow',doc);
  if(result){issues.push({record:i+1,date:r.sourceDate,location:r.location,reason:result});return;}
  used.add(key);placed++;
 });
 const body=descendants(doc.documentElement,'body')[0];if(!body)throw Error('Missing Word document body.');
 const sect=direct(body,'sectPr');const insert=(p)=>sect?body.insertBefore(p,sect):body.appendChild(p);
 function paragraph(text,bold=false,color=null,pageBreak=false){
  const p=doc.createElementNS(W,'w:p'),pr=doc.createElementNS(W,'w:pPr');p.appendChild(pr);
  const run=doc.createElementNS(W,'w:r'),rpr=doc.createElementNS(W,'w:rPr');if(bold){const b=doc.createElementNS(W,'w:b');rpr.appendChild(b);}if(color){const hl=doc.createElementNS(W,'w:highlight');hl.setAttributeNS(W,'w:val',color);rpr.appendChild(hl);}run.appendChild(rpr);
  if(pageBreak){const br=doc.createElementNS(W,'w:br');br.setAttributeNS(W,'w:type','page');run.appendChild(br);}
  const t=doc.createElementNS(W,'w:t');t.textContent=text;run.appendChild(t);p.appendChild(run);insert(p);return p;
 }
 paragraph('GCF-400 | DOCUMENT AUDIT LEGEND',true,null,true);
 paragraph('Highlights indicate date–weekday consistency only, not proof of event authenticity.');
 const tally=counts(rows);for(const key of STATUSES)paragraph(`${key} (${tally[key]}) — ${LEGEND[key].meaning}`,true,LEGEND[key].word);
 paragraph(`${rows.length} findings | ${placed} annotated source dates | ${issues.length} unresolved anchors`,true);
 paragraph('Unresolved anchors remain in the companion CSV report; the original document is unchanged.');
 return {xml:new XMLSerializer().serializeToString(doc),placed,issues};
}
async function annotateDocx(file,rows,JSZipCtor,includeMatches=false){
 if(!JSZipCtor)throw Error('JSZip unavailable');const z=await JSZipCtor.loadAsync(file);const docEntry=z.file('word/document.xml');if(!docEntry)throw Error('DOCX document.xml missing');
 const text=await docEntry.async('string');const result=annotateDOCXXml(text,rows,includeMatches);z.file('word/document.xml',result.xml,{createFolders:false});
 const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
 return {blob,summary:summary(file,rows,result.placed,result.issues,'docx')};
}
async function annotatePdf(file,rows,includeMatches=false){if(typeof globalThis!=='undefined'&&globalThis.GCFAdvancedPDF&&globalThis.PDFLib)return globalThis.GCFAdvancedPDF.annotatePdf(file,rows,includeMatches);const buf=new Uint8Array(await file.arrayBuffer());return appendPDF(buf,rows,includeMatches);}
return {annotatePdf,annotateDocx,annotateDOCXXml,appendPDF,getPosition,LEGEND};
});
