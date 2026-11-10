(function(){
'use strict';
const $=id=>document.getElementById(id);let docs=[],rows=[],coverage=[],urls=[],running=false,stopRequested=false,quality=[],displayRows=[],previewKey='',previewViewport=null,previewSeq=0,lastSettings=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
// Protect reviewers opening exported CSV files in Excel/Sheets against formula injection.
// Never allow untrusted filenames, OCR text or document cells to become formulas.
const safeCsvCell=v=>{const text=String(v??'').replace(/\u0000/g,'');return /^[\s\uFEFF]*[=+@\-\t\r]/.test(text)?"'"+text:text;};
const q=v=>'"'+safeCsvCell(v).replace(/"/g,'""')+'"';
const csv=(heads,items)=>'\uFEFF'+[heads.map(q).join(','),...items.map(it=>it.map(q).join(','))].join('\r\n');
const recordCSV=()=>csv(['File','Page','Location','Date','Recorded weekday','Expected weekday','Status','Method','Confidence','Association','Reading rule','Source evidence','Note'],rows.map(r=>[r.file,r.page,r.location,r.date,r.recorded,r.expected,r.status,r.method,r.confidence,r.association,(lastSettings?.reading||$('reading').value),r.dayEvidence||r.sourceText,r.note]));
const coverageCSV=()=>csv(['File','Page','Status','Text method','Native lines','OCR attempted','OCR lines','OCR confidence','Processing ms','Notes'],coverage.map(c=>[c.file,c.page,c.status,c.method,c.nativeLines,c.ocrAttempted,c.ocrLines,c.ocrConfidence,c.durationMs??0,c.note]));
const qualityCSV=()=>csv(['Source file','Bytes','SHA256 (if supported)','PDF pages or DOCX units','Readable or blank','Unchecked','Date expressions','Matches','Mismatches','Review','Processing ms','Outcome'],quality.map(q=>[q.file,q.bytes,q.sha256,q.pages,q.processed,q.unchecked,q.dates,q.matches,q.mismatches,q.review,q.elapsedMs,q.outcome]));
function status(text,kind='normal'){$('status').textContent=text;$('status').className='status'+(kind==='warning'?' warning':kind==='error'?' error':'');}
function linksClear(){urls.forEach(x=>URL.revokeObjectURL(x));urls=[];$('links').replaceChildren();}
async function fingerprint(file){if(!globalThis.crypto?.subtle)return '';const h=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(h)].map(n=>n.toString(16).padStart(2,'0')).join('');}
function direct(blob,name,label){const url=URL.createObjectURL(blob);urls.push(url);const link=document.createElement('a');link.className='download';link.href=url;link.download=name;link.textContent=label||name;$('links').appendChild(link);return link;}
function reset(){lastSettings=null;$('scanProgress').classList.add('hide');$('extractionDiagnostics').textContent='';if(running)return status('Finish or cancel the current scan before clearing.','warning');docs=[];rows=[];coverage=[];quality=[];displayRows=[];previewSeq++;previewKey='';previewViewport=null;linksClear();$('files').value='';$('results').classList.add('hide');$('pdfPreviewCard').classList.add('hide');$('retryPages').classList.add('hide');$('scanQuality').textContent='Quality summary appears after scanning.';$('scanQuality').className='quality-panel';$('status').textContent='';$('status').className='status hide';GCFPDF.closePreview().catch(()=>{});}
function summarize(){let c=Object.fromEntries(['MATCH','MISMATCH','INVALID','REVIEW','DATE_ONLY'].map(s=>[s,0]));rows.forEach(r=>c[r.status]=(c[r.status]||0)+1);$('statDates').textContent=rows.length.toLocaleString();$('statMatches').textContent=c.MATCH.toLocaleString();$('statMismatch').textContent=c.MISMATCH.toLocaleString();$('statReview').textContent=c.REVIEW.toLocaleString();$('statDateOnly').textContent=c.DATE_ONLY.toLocaleString();$('statPages').textContent=coverage.length.toLocaleString();
 const filter=$('resultFilter').value,search=$('resultSearch').value.trim().toLowerCase();
 const filtered=rows.filter(r=>(filter==='ALL'||r.status===filter)&&(!search||[r.file,r.sourceDate,r.date,r.recorded,r.expected,r.sourceText,r.note].some(v=>String(v??'').toLowerCase().includes(search))));
 let chosen=[...filtered.filter(r=>r.status==='MISMATCH'||r.status==='INVALID'),...filtered.filter(r=>r.status==='REVIEW'),...filtered.filter(r=>r.status==='MATCH'),...filtered.filter(r=>r.status==='DATE_ONLY')].slice(0,100);displayRows=chosen;$('recordRows').innerHTML=chosen.map((r,i)=>`<tr tabindex="0" class="audit-record" data-record="${i}" aria-label="Inspect ${esc(r.file)} page ${esc(r.page)} date ${esc(r.sourceDate)}"><td>${esc(r.file)}</td><td>${esc(r.page)}</td><td>${esc(r.sourceDate)}</td><td>${esc(r.recorded||'—')}</td><td>${esc(r.expected||'—')}</td><td><span class="pill ${esc(r.status)}">${esc(r.status)}</span></td></tr>`).join('')||'<tr><td colspan="6">No recognizable date expressions. This is not proof the document is error-free.</td></tr>';
 $('coverageRows').innerHTML=coverage.map(r=>`<tr><td>${esc(r.file)}</td><td>${esc(r.page)}</td><td>${esc(r.method)}</td><td>${esc(r.status)}</td><td>${esc(r.ocrConfidence??'—')}</td><td>${esc(r.durationMs??'—')} ms</td><td>${esc(r.note||'')}</td></tr>`).join('');$('previewNote').textContent=`Showing ${chosen.length} of ${filtered.length} matching findings (${rows.length} total). Full findings CSV contains all results.`;
 updateQualityPanel();$('results').classList.remove('hide');$('downloadPdf').disabled=!docs.some(d=>/\.pdf$/i.test(d.fileObj?.name));$('downloadPdf').classList.toggle('hide',!docs.some(d=>/\.pdf$/i.test(d.fileObj?.name)));
 const first=displayRows.findIndex(r=>Number.isInteger(r.page)&&/\.pdf$/i.test(r.file));
 if(first>=0)showPdfPreview(first).catch(e=>{$('pdfPreviewStatus').textContent='PDF preview unavailable: '+e.message;});
 else $('pdfPreviewCard').classList.add('hide');
}
function updateQualityPanel(){
 const unreadable=coverage.filter(c=>['UNREADABLE','SKIPPED','FAILED'].includes(c.status));
 const scanned=coverage.filter(c=>c.status==='READABLE'||c.status==='BLANK');
 const errors=rows.filter(r=>r.status==='MISMATCH'||r.status==='INVALID').length;
 const reviews=rows.filter(r=>r.status==='REVIEW').length;
 const conflictingPages=coverage.filter(c=>c.disagreement).length;
 const pairCount=rows.filter(r=>r.status==='MATCH'||r.status==='MISMATCH').length;
 const ocrPages=coverage.filter(c=>c.ocrAttempted).length;
 const durations=coverage.reduce((n,c)=>n+(Number(c.durationMs)||0),0);
 const missingPositions=rows.filter(r=>/\.pdf$/i.test(r.file||'')&&(!r.hasDatePosition||(['MATCH','MISMATCH'].includes(r.status)&&!r.hasDayPosition))).length;
 const state=GCFAuditUtils.summarize(rows,coverage).state;
 const node=$('scanQuality');node.className='quality-panel'+(unreadable.length||reviews||!pairCount||missingPositions?' warning':'');
 node.textContent='Overall audit state: '+state+'\nPage coverage: '+scanned.length+'/'+coverage.length+' readable or verified blank · '+unreadable.length+' incomplete\nPrinted weekday/date pairs: '+pairCount+' · errors: '+errors+' · review: '+reviews+' · date-only: '+rows.filter(r=>r.status==='DATE_ONLY').length+'\nPages with conflicting text/OCR evidence: '+conflictingPages+' (manual review)\nFindings with incomplete PDF highlight positions: '+missingPositions+'\nOCR attempted on '+ocrPages+' page(s) · page processing: '+(durations/1000).toFixed(2)+' seconds (excludes previews/exports)\n'+(unreadable.length?'Incomplete pages require retry or manual verification.':!pairCount?'No paired weekdays confirmed; inspect extraction diagnostics.':'All pages processed, but undetected text remains possible.')+' This report is not a certification of the source document.';
 const headline=$('auditHeadline');
 if(headline){
  headline.className='audit-headline'+(unreadable.length||errors?' danger':reviews||!pairCount?' warning':'');
  headline.textContent=unreadable.length?'Some pages could not be checked. Review or retry the incomplete pages.':
   errors?`${errors} possible date ${errors===1?'problem':'problems'} found. Check the flagged rows below.`:
   reviews?`${reviews} ${reviews===1?'finding needs':'findings need'} manual review. Check the yellow rows.`:
   !pairCount?'No weekday–date pairs were confirmed. See Scan details below.':
   `Scan finished. ${pairCount} weekday–date ${pairCount===1?'pair':'pairs'} checked.`;
 }
 $('retryPages').classList.toggle('hide',!docs.some(d=>/\.pdf$/i.test(d.fileObj.name)&&d.coverage.some(c=>c.status==='UNREADABLE'||c.status==='SKIPPED')));
}
const previewColors={MATCH:'rgba(47,190,76,.30)',MISMATCH:'rgba(232,58,65,.32)',REVIEW:'rgba(252,182,37,.32)',INVALID:'rgba(255,118,38,.34)',DATE_ONLY:'rgba(87,158,235,.28)'};
function annotationSummary(r){
 const date=(r.sourceDate||'Not available')+(r.date&&r.date!==r.sourceDate?' ['+r.date+']':'');
 return `Status: ${r.status||'REVIEW'}\nDate checked: ${date}\nRecorded weekday: ${r.recorded||'Not printed'}\nExpected weekday: ${r.expected||'Not available'}${r.note?'\nNote: '+r.note:''}`;
}
function drawPreviewOverlays(file,page,selectedIndex){
 const target=$('pdfPreviewOverlays');target.replaceChildren();if(!previewViewport)return;
 $('annotationDetails').textContent='Hover, tap, or keyboard-focus a colored date to see its status, recorded weekday, and expected weekday.';
 const all=rows.filter(r=>r.file===file&&r.page===page&&(r.rects?.length||r.rect));
 let highlighted=0;
 for(const r of all)for(const q of (r.rects?.length?r.rects:[r.rect])){
  if(!q)continue;let points;
  try{points=previewViewport.convertToViewportRectangle([q.x0,q.y0,q.x1,q.y1]);}catch(e){continue;}
  if(!points?.every(Number.isFinite))continue;
  const left=Math.min(points[0],points[2]),top=Math.min(points[1],points[3]),width=Math.abs(points[2]-points[0]),height=Math.abs(points[3]-points[1]);
  if(width<2||height<2)continue;
  const item=document.createElement('div');item.className='pdf-mark';
  if(displayRows[selectedIndex]===r)item.classList.add('pdf-mark-active');
  if(top<110)item.classList.add('pdf-tooltip-below');
  if(left>previewViewport.width-245)item.classList.add('pdf-tooltip-right');
  item.style.cssText=`left:${left}px;top:${top}px;width:${width}px;height:${height}px;background:${previewColors[r.status]||previewColors.REVIEW}`;
  const detail=annotationSummary(r),tip=document.createElement('span');tip.className='pdf-tooltip';tip.textContent=detail;
  item.setAttribute('tabindex','0');item.setAttribute('role','button');item.setAttribute('aria-label',detail.replace(/\n/g,'. '));item.appendChild(tip);
  const activate=()=>{target.querySelectorAll('.pdf-mark-info-active').forEach(n=>n.classList.remove('pdf-mark-info-active'));item.classList.add('pdf-mark-info-active');$('annotationDetails').textContent=detail;};
  item.addEventListener('pointerenter',activate);item.addEventListener('focus',activate);item.addEventListener('click',activate);
  item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
  target.appendChild(item);highlighted++;
 }
 $('pdfPreviewStatus').textContent=`Page ${page} · ${highlighted} located highlight(s) · Hover, tap or focus a highlighted date to inspect status and expected weekday`;
}
async function showPdfPreview(index){
 const row=displayRows[index];if(!row||!/\.pdf$/i.test(row.file)||!Number.isInteger(row.page))return;
 const documentInfo=docs.find(d=>d.fileObj?.name===row.file);
 if(!documentInfo)return;
 $('pdfPreviewCard').classList.remove('hide');
 for(const tr of $('recordRows').querySelectorAll('tr[data-record]'))tr.classList.toggle('audit-active',Number(tr.dataset.record)===index);
 const key=row.file+'|'+row.page,sequence=++previewSeq;
 if(previewKey!==key||!previewViewport){
  $('pdfPreviewStatus').textContent='Rendering source page '+row.page+'…';
  const viewport=await GCFPDF.previewPage(documentInfo.fileObj,row.page,$('pdfPreviewCanvas'));
  if(sequence!==previewSeq)return;
  previewKey=key;previewViewport=viewport;
 }
 drawPreviewOverlays(row.file,row.page,index);
}
$('recordRows').addEventListener('mouseover',e=>{const tr=e.target.closest('tr[data-record]');if(tr&&!tr.contains(e.relatedTarget))showPdfPreview(Number(tr.dataset.record)).catch(er=>{$('pdfPreviewStatus').textContent=er.message;});});
$('recordRows').addEventListener('focusin',e=>{const tr=e.target.closest('tr[data-record]');if(tr)showPdfPreview(Number(tr.dataset.record)).catch(er=>{$('pdfPreviewStatus').textContent=er.message;});});
$('recordRows').addEventListener('click',e=>{const tr=e.target.closest('tr[data-record]');if(tr)showPdfPreview(Number(tr.dataset.record)).catch(er=>{$('pdfPreviewStatus').textContent=er.message;});});
$('resultFilter').addEventListener('change',summarize);
$('resultSearch').addEventListener('input',summarize);
async function scan(){if(running)return;const files=[...$('files').files];if(!files.length)return status('Choose one or more PDF or Word files.','warning');if(files.length>10)return status('Select up to ten files.','warning');if(files.some(f=>f.size>15*1024*1024))return status('Some files exceed 15 MB. Split them before scanning.','warning');if(new Set(files.map(f=>f.name.toLowerCase())).size!==files.length)return status('Rename duplicate filenames to avoid mixing findings.','warning');try{GCFAuditUtils.inspectNames(files);for(const file of files)await GCFAuditUtils.inspectFile(file);}catch(e){return status('Upload validation: '+e.message,'error');}
 $('scanProgress').classList.remove('hide');$('scanProgressBar').value=0;$('progressText').textContent='Preparing documents…';lastSettings={reading:$('reading').value,ocr:$('ocr').value,order:$('order').value,readingLabel:$('reading').selectedOptions[0].text,ocrLabel:$('ocr').selectedOptions[0].text,orderLabel:$('order').selectedOptions[0].text};running=true;stopRequested=false;$('scan').disabled=true;$('reset').disabled=true;$('cancel').classList.remove('hide');docs=[];rows=[];coverage=[];quality=[];linksClear();$('results').classList.add('hide');$('pdfPreviewCard').classList.add('hide');previewKey='';previewViewport=null;previewSeq++;const problems=[];try{for(const [i,file] of files.entries()){
   status(`Scanning ${file.name} (${i+1}/${files.length})...`);
   try{const started=performance.now();let document;if(stopRequested)throw Error('Scan canceled.');if(/\.pdf$/i.test(file.name)){
    $('engine').textContent='Loading PDF.js; Tesseract OCR is loaded on demand…';document=await GCFPDF.readPdf(file,{reading:$('reading').value,order:$('order').value,ocr:$('ocr').value,shouldStop:()=>stopRequested,onProgress:(a,b,method)=>{const percent=Math.round(100*(i+a/Math.max(1,b))/files.length);$('scanProgressBar').value=percent;$('progressText').textContent=`${file.name} · page ${a}/${b} · ${method} · ${percent}%`;}});$('engine').textContent=`PDF.js ready. PDF pages are inspected individually; OCR is ${$('ocr').value}.`;
   }else if(/\.docx$/i.test(file.name)){document=await GCFWord.read(file);}else throw Error('Only PDF and DOCX files are supported');
   if(stopRequested&&!document.stopped)throw Error('Scan canceled.');
   const scanned=GCFScanner.scanDocument([document],{order:$('order').value,reading:$('reading').value});
   const conflictPages=new Set(document.coverage.filter(c=>c.disagreement).map(c=>c.page));
   for(const rec of scanned.records)if(conflictPages.has(rec.page)&&rec.status!=='INVALID'){
    scanned.counts[rec.status]--;scanned.counts.REVIEW++;rec.status='REVIEW';
    rec.note=(rec.note||'')+'; PDF text and OCR disagree on this page. Manually inspect original.';
   }
   docs.push({...document,fileObj:file});coverage.push(...document.coverage.map(p=>({nativeLines:p.nativeLines??0,ocrAttempted:p.ocrAttempted??false,ocrLines:p.ocrLines??0,ocrConfidence:p.ocrConfidence??'',note:p.note||'',...p})));
   rows.push(...scanned.records);
   const processed=document.coverage.filter(x=>x.status==='READABLE'||x.status==='BLANK').length;
   quality.push({file:file.name,bytes:file.size,sha256:await fingerprint(file).catch(()=>'unavailable'),pages:document.pageCount||document.coverage.length,processed,unchecked:document.coverage.length-processed,dates:scanned.records.length,matches:scanned.counts.MATCH,mismatches:scanned.counts.MISMATCH,review:scanned.counts.REVIEW,elapsedMs:Math.round(performance.now()-started),outcome:document.complete?'PAGES PROCESSED, DATE EXTRACTION NOT CERTIFIED':'INCOMPLETE'});
   if(!document.complete)problems.push(file.name+': '+(document.scopeWarning||'incomplete pages '+(document.unchecked||[]).map(p=>p.page).join(', ')));if(stopRequested)break;
   }catch(error){problems.push(file.name+': '+error.message);coverage.push({file:file.name,page:'—',status:'FAILED',method:'Unavailable',note:error.message});quality.push({file:file.name,bytes:file.size,sha256:'',pages:0,processed:0,unchecked:1,dates:0,matches:0,mismatches:0,review:0,elapsedMs:0,outcome:'FAILED: '+error.message});if(stopRequested)break;}
  }

  const diagnostic=[];
  for(const d of docs){
    diagnostic.push('FILE: '+d.file+' — '+d.pageCount+' pages');
    const relevant=(d.lines||[]).filter(l=>GCFScanner.dateMatches(l.text,lastSettings?.order||'auto').length||GCFScanner.dayMatches(l.text).length);
    for(const l of relevant.slice(0,150)) diagnostic.push('Page '+l.page+' ['+l.method+'] '+l.text);
    if(relevant.length>150)diagnostic.push('... '+(relevant.length-150)+' additional lines omitted');
    if(!relevant.length)diagnostic.push('No date or weekday strings could be reconstructed.');
  }
  $('extractionDiagnostics').textContent=diagnostic.join('\n')||'No extracted lines. Check the page coverage and error report.';
  summarize();const passed=coverage.filter(c=>c.status==='READABLE'||c.status==='BLANK').length,total=coverage.filter(c=>Number.isInteger(c.page)).length;const bad=coverage.filter(c=>c.status==='UNREADABLE'||c.status==='FAILED'||c.status==='PARTIAL').length;const weekdayWords=docs.reduce((n,d)=>n+(d.lines||[]).reduce((t,l)=>t+GCFScanner.dayMatches(l.text).length,0),0),paired=rows.filter(r=>r.status==='MATCH'||r.status==='MISMATCH').length,unpaired=rows.filter(r=>r.status==='DATE_ONLY').length;
  if(problems.length||bad)status('Scan finished with incomplete pages. See results for details.','warning');
  else if(!paired)status('Scan finished. No weekday–date pairs confirmed. Check scan details.','warning');
  else status('Scan complete. Review the findings below.');
  $('results').scrollIntoView?.({behavior:'smooth',block:'start'});
 }finally{running=false;$('scanProgressBar').value=100;$('progressText').textContent=stopRequested?'Scan stopped. Review coverage and errors.':'Scan finished. Review findings and coverage.';$('scan').disabled=false;$('reset').disabled=false;$('cancel').classList.add('hide');try{await GCFPDF.closeOCR();}catch(e){}}}
function saveText(content,name,label){const link=direct(new Blob([content],{type:'text/csv;charset=utf-8'}),name,label);link.click();}
async function annotatedPDF(doc,selected){await GCFPDF.load('write');return GCFPdfExport.create(doc.fileObj,selected);}

async function downloadHighlightedPDF(){
 const pdfs=docs.filter(d=>/\.pdf$/i.test(d.fileObj?.name));
 if(!pdfs.length)return status('Scan a PDF file first.','warning');
 const button=$('downloadPdf');button.disabled=true;let count=0;const errors=[];
 try{
  await GCFPDF.load('write');
  for(const d of pdfs){
   if(!d.complete){errors.push(d.fileObj.name+': not all pages were readable');continue;}
   const records=rows.filter(r=>r.file===d.fileObj.name);
   try{
    const result=await GCFPdfExport.create(d.fileObj,records);
    const stem=d.fileObj.name.replace(/\.pdf$/i,'').replace(/[^\w.-]/g,'_');
    const link=direct(result.blob,`${stem}_Highlighted.pdf`,`Save highlighted ${d.fileObj.name} (${result.fullyAnnotated} findings fully located)`);
    if(count===0)link.click();count++;
    if(result.unresolved.length)errors.push(d.fileObj.name+': '+result.unresolved.length+' findings have missing or incomplete positions (read the appended PDF legend and findings CSV)');
   }catch(e){errors.push(d.fileObj.name+': '+e.message);}
  }
  status(`${count} highlighted PDF(s) generated. ${errors.length?errors.join(' | '):'No detected coordinate omissions.'} The result page shows both located and unresolved findings; review the original source before relying on the audit. Files are linked below.`,errors.length?'warning':'normal');
 }catch(e){status('PDF export unavailable: '+e.message,'error');}
 finally{button.disabled=false;}
}
// Automatically generate a signed audit proof for exported reports.
async function createSignedEvidence(){
 const missing=quality.filter(x=>!/^[a-f0-9]{64}$/.test(x.sha256||''));
 if(missing.length)throw Error('Source file checksums are unavailable: '+missing.map(x=>x.file).join(', '));
 // Reuse an explicitly saved device key if present, without making key setup a requirement.
 if(selectedSigner!=='stored'){
  try{
   const saved=await GCFSecurity.useDeviceKey();
   selectedSigner='stored';
   showSigner('Previously saved signing key selected automatically.',saved.fingerprint,'success');
  }catch(_){/* No saved key: GCFSecurity creates a temporary, non-exportable key automatically. */}
 }
 const evidence=GCFAuditUtils.manifest({rows,coverage,quality,settings:lastSettings||{},version:'v29'});
 const sealed=await GCFSecurity.seal(evidence);
 const verification=await GCFSecurity.verify(sealed);
 if(!verification.valid)throw Error('Automatic integrity verification failed: '+verification.reason);
 return sealed;
}
async function downloadPackage(){if(!docs.length&&!coverage.length)return status('Run a scan first.','warning');$('downloadPackage').disabled=true;status('Preparing your reports. The original documents will not be overwritten.');try{const zip=new JSZip();zip.file('GCF_Audit_Settings.txt',`GCF-400 v29\r\nWeekday-date reading rule: ${lastSettings?.readingLabel||$('reading').selectedOptions[0].text}\r\nPDF recognition: ${lastSettings?.ocrLabel||$('ocr').selectedOptions[0].text}\r\nNumeric date order: ${lastSettings?.orderLabel||$('order').selectedOptions[0].text}\r\nDATE_ONLY is an informational date reference, not an error.\r\nREVIEW is not a certified match or mismatch.\r\n`);zip.file('GCF_Findings.csv',recordCSV());zip.file('GCF_Page_Coverage.csv',coverageCSV());zip.file('GCF_Quality_Evidence.csv',qualityCSV());zip.file('GCF_Audit_Evidence.json',JSON.stringify(GCFAuditUtils.manifest({rows,coverage,quality,settings:lastSettings||{},version:'v29'}),null,2));
const issues=[];let files=0;let proofIncluded=false;
try{
 const signed=await createSignedEvidence();
 zip.file('Verification/GCF400_Signed_Evidence.json',JSON.stringify(signed,null,2));
 zip.file('Verification/ABOUT_THE_PROOF.txt','This report includes an automatically signed record of the audit findings and original source-file hashes.\r\nTo check it, open GCF-400 > Verify a saved report and select this ZIP. You do not need to open or edit the JSON file.\r\nA valid signature only shows that the signed audit evidence has not changed relative to the included public key. It does NOT verify the signer identity, guarantee the correctness of findings, or authenticate PRC documents. The signature does not protect other files in this ZIP independently.\r\n');
 proofIncluded=true;
}catch(e){
 issues.push('Automatic audit proof not available: '+e.message);
 zip.file('Verification/PROOF_UNAVAILABLE.txt','The report could not be signed automatically: '+e.message+'\r\nThese findings and exports are NOT cryptographically signed. Do not represent them as signed evidence.\r\n');
}

 for(const doc of docs){const selected=rows.filter(r=>r.file===doc.fileObj.name&&['MATCH','MISMATCH','INVALID','REVIEW','DATE_ONLY'].includes(r.status));const stem=doc.fileObj.name.replace(/\.(pdf|docx)$/i,'').replace(/[^\w.-]/g,'_');
  try{if(/\.pdf$/i.test(doc.fileObj.name)){
   if(!doc.complete)throw Error('Incomplete PDF page coverage. Annotations not certified.');const a=await annotatedPDF(doc,selected);zip.file(`Annotated/${stem}_Annotated.pdf`,a.blob);direct(a.blob,`${stem}_Annotated.pdf`,`Open/download highlighted ${doc.fileObj.name}`);files++;issues.push(...a.unresolved.map(t=>doc.fileObj.name+': '+t));
  }else{const a=await GCFWord.annotate(doc.fileObj,selected);zip.file(`Annotated/${stem}_Annotated.docx`,a.blob);files++;issues.push(...a.issues.map(it=>doc.fileObj.name+': '+it.reason));}}
  catch(e){issues.push(doc.fileObj.name+': annotation export unavailable ('+e.message+')');}
 }
 zip.file('Annotation_Notes.txt',`Generated annotated files: ${files}\r\nUnresolved locations or issues:\r\n${issues.length?issues.join('\r\n'):'None identified'}\r\n\r\nOriginal uploads were never overwritten. A missing annotation must not be interpreted as a correct record.\r\n`);
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});const link=direct(blob,'GCF400_Audit_Reports.zip','Save ZIP of findings, coverage, and annotated copies');link.click();status(`Report ZIP prepared with ${files} annotated document(s). ${proofIncluded?'Signed audit proof was added automatically.':'Warning: signed audit proof could not be created.'} ${issues.length} export notes. Original documents were not overwritten.`,issues.length?'warning':'normal');
 }catch(e){status('Export failed: '+e.message,'error');}finally{$('downloadPackage').disabled=false;}}
async function retryIncomplete(){
 if(running)return;
 const targets=docs.filter(d=>/\.pdf$/i.test(d.fileObj?.name)).map(doc=>({doc,pages:doc.coverage.filter(c=>c.status==='UNREADABLE'||c.status==='SKIPPED').map(c=>c.page)})).filter(x=>x.pages.length);
 if(!targets.length)return status('There are no incomplete PDF pages to retry.','warning');
 running=true;stopRequested=false;$('scan').disabled=true;$('retryPages').disabled=true;$('cancel').classList.remove('hide');$('scanProgress').classList.remove('hide');
 const problems=[];
 try{for(const {doc,pages} of targets){
  if(stopRequested)break;
  status('Retrying '+pages.length+' incomplete page(s) in '+doc.file+'…');
  try{
   const delta=await GCFPDF.readPdf(doc.fileObj,{pageNumbers:pages,reading:lastSettings?.reading||'auto',order:lastSettings?.order||'auto',ocr:lastSettings?.ocr==='off'?'auto':lastSettings?.ocr||'auto',shouldStop:()=>stopRequested,onProgress:(done,total,phase)=>{$('scanProgressBar').value=Math.round(100*done/total);$('progressText').textContent='Retry '+done+'/'+total+' · '+phase;}});
   const touched=new Set(delta.coverage.map(c=>c.page));
   doc.lines=doc.lines.filter(l=>!touched.has(l.page)).concat(delta.lines);
   doc.coverage=doc.coverage.filter(c=>!touched.has(c.page)).concat(delta.coverage).sort((a,b)=>a.page-b.page);
   doc.unchecked=doc.coverage.filter(c=>c.status==='UNREADABLE'||c.status==='SKIPPED');doc.complete=!doc.unchecked.length&&doc.coverage.length===doc.pageCount;
   const rerun=GCFScanner.scanDocument([doc],{reading:lastSettings?.reading||'auto',order:lastSettings?.order||'auto'});
   const conflictPages=new Set(doc.coverage.filter(c=>c.disagreement).map(c=>c.page));
   for(const rec of rerun.records)if(conflictPages.has(rec.page)&&rec.status!=='INVALID'){
    rerun.counts[rec.status]--;rerun.counts.REVIEW++;rec.status='REVIEW';
    rec.note=(rec.note||'')+'; PDF text and OCR disagree; manually inspect original.';
   }
   rows=rows.filter(r=>r.file!==doc.file).concat(rerun.records);
   const q=quality.find(x=>x.file===doc.file);if(q){q.processed=doc.coverage.length-doc.unchecked.length;q.unchecked=doc.unchecked.length;q.dates=rerun.records.length;q.matches=rerun.counts.MATCH;q.mismatches=rerun.counts.MISMATCH;q.review=rerun.counts.REVIEW;q.elapsedMs+=delta.coverage.reduce((n,c)=>n+(c.durationMs||0),0);q.outcome=doc.complete?'PAGES PROCESSED, DATE EXTRACTION NOT CERTIFIED':'INCOMPLETE';}
  }catch(e){problems.push(doc.file+': '+e.message);}
 }
 coverage=docs.flatMap(d=>d.coverage);
 summarize();status(problems.length?'Some retries failed: '+problems.join(' | '):stopRequested?'Retry interrupted. Completed page results retained.':'Retry finished. Check page coverage and extraction diagnostics; results are not certified.',problems.length||stopRequested?'warning':'normal');
 }finally{running=false;$('scan').disabled=false;$('retryPages').disabled=false;$('cancel').classList.add('hide');try{await GCFPDF.closeOCR();}catch(e){}}
}
$('retryPages').addEventListener('click',retryIncomplete);
$('scan').addEventListener('click',scan);$('cancel').addEventListener('click',()=>{stopRequested=true;status('Cancel requested. The current PDF/OCR operation may finish before it can stop.','warning');});$('reset').addEventListener('click',reset);$('downloadRecords').addEventListener('click',()=>saveText(recordCSV(),'GCF_Findings.csv','Findings CSV'));
$('downloadCoverage').addEventListener('click',()=>saveText(coverageCSV(),'GCF_Page_Coverage.csv','Page coverage CSV'));
$('downloadEvidence').addEventListener('click',()=>saveText(qualityCSV(),'GCF_Quality_Evidence.csv','Quality evidence CSV'));
$('downloadManifest').addEventListener('click',()=>{const data=GCFAuditUtils.manifest({rows,coverage,quality,settings:lastSettings||{},version:'v29'});const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const link=direct(blob,'GCF400_Audit_Evidence.json','Save structured audit evidence');link.click();});
let selectedSigner='temporary';
function showSigner(message,fingerprint='',state='info'){
 GCFSecurityUI.keyStatus({message,fingerprint,state});
 $('deviceCopyStatus').textContent='';
}
$('copyDeviceFingerprint').addEventListener('click',()=>GCFSecurityUI.copyFingerprint());
$('createDeviceSigner').addEventListener('click',async()=>{
 if(!confirm('Create a reusable device signing key? This replaces the previously saved signing key. Old reports remain independently verifiable.'))return;
 showSigner('Creating a device signing key…');
 try{const r=await GCFSecurity.createDeviceKey();selectedSigner='stored';showSigner('Saved device key created and selected. To reuse it in a later session, choose “Use saved key”.',r.fingerprint,'success');}
 catch(e){selectedSigner='temporary';showSigner('Could not create key: '+e.message,'','invalid');}
});
$('loadDeviceSigner').addEventListener('click',async()=>{
 showSigner('Loading the saved device key…');
 try{const r=await GCFSecurity.useDeviceKey();selectedSigner='stored';showSigner('Saved device key selected. Future signed exports from this tab will use this fingerprint.',r.fingerprint,'success');}
 catch(e){selectedSigner='temporary';showSigner('Saved key unavailable: '+e.message,'','warning');}
});
$('eraseDeviceSigner').addEventListener('click',async()=>{
 if(!confirm('Erase the saved signing key? New reports can no longer use that key. Existing signed reports remain verifiable.'))return;
 showSigner('Erasing saved key…');
 try{await GCFSecurity.eraseDeviceKey();selectedSigner='temporary';showSigner('Saved key erased. Exports will use a temporary key until you create or select another saved key.','','success');}
 catch(e){showSigner('Could not erase saved key: '+e.message,'','invalid');}
});
$('downloadSignedManifest').addEventListener('click',async()=>{
 const button=$('downloadSignedManifest');if(!rows.length&&!coverage.length)return status('Scan a document before exporting audit proof.','warning');
 button.disabled=true;
 try{
  const sealed=await createSignedEvidence();
  direct(new Blob([JSON.stringify(sealed,null,2)],{type:'application/json'}),'GCF400_Signed_Evidence.json','Save audit proof JSON').click();
  status('Audit proof saved. You can also download the complete report ZIP, which includes this proof automatically.');
 }catch(e){status('Audit proof unavailable: '+e.message,'error');}
 finally{button.disabled=false;}
});
$('verifyEvidence').addEventListener('click',async()=>{
 const file=$('verifyEvidenceFile').files[0],source=$('verifySourceFile').files[0],button=$('verifyEvidence');
 if(!file){GCFSecurityUI.verificationStatus({message:'Choose a report ZIP or audit proof JSON to check.',state:'warning'});return;}
 const zipped=/\.zip$/i.test(file.name),maxBytes=zipped?180*1024*1024:4*1024*1024;
 if(file.size>maxBytes){GCFSecurityUI.verificationStatus({message:zipped?'Report ZIP exceeds the 180 MB verification limit.':'Audit proof JSON exceeds 4 MB.',state:'invalid'});return;}
 button.disabled=true;GCFSecurityUI.verificationStatus({message:'Checking whether the audit results have changed…'});
 try{
  let raw;
  if(zipped){
   const zip=await JSZip.loadAsync(file);
   const entry=zip.file('Verification/GCF400_Signed_Evidence.json');
   if(!entry)throw Error('This ZIP has no signed audit proof. Download a new report ZIP from GCF-400.');
   if(Number.isFinite(entry._data?.uncompressedSize)&&entry._data.uncompressedSize>4*1024*1024)throw Error('The audit proof in this ZIP exceeds the 4 MB limit.');
   raw=await entry.async('string');
  }else if(/\.json$/i.test(file.name)){raw=await file.text();}
  else throw Error('Choose a GCF-400 report ZIP or signed audit proof JSON.');
  if(raw.length>4*1024*1024)throw Error('The audit proof exceeds the 4 MB limit.');
  const envelope=GCFSecurity.parseEnvelope(raw);
  const result=source?await GCFSecurity.verifySourceFile(envelope,source):await GCFSecurity.verify(envelope);
  const trusted=$('trustedKeyFingerprint').value.trim().toLowerCase();
  if(trusted&&!/^[a-f0-9]{64}$/.test(trusted))throw Error('Enter exactly 64 hexadecimal characters for the trusted key.');
  const matchesKey=trusted?result.fingerprint===trusted:null;
  const valid=result.valid&&(!source||result.sourceMatch)&&matchesKey!==false;
  GCFSecurityUI.verificationStatus({
   message:(valid?'Audit proof is intact. ':'Audit proof could not be verified. ')+result.reason+' This does not authenticate the signer or certify the original document.',
   state:valid?'success':'invalid',fingerprint:result.fingerprint||'',digest:result.hash||'',
   sourceResult:source?(result.sourceMatch?'Source file hash matches':'Source file hash does not match'):'Not supplied',
   trustResult:trusted?(matchesKey?'Trusted fingerprint matches':'Trusted fingerprint differs'):'No independent trusted key supplied'
  });
 }catch(e){GCFSecurityUI.verificationStatus({message:'Verification error: '+e.message,state:'invalid'});}
 finally{button.disabled=false;}
});
$('clearVerification').addEventListener('click',()=>{
 $('verifyEvidenceFile').value='';$('verifySourceFile').value='';$('trustedKeyFingerprint').value='';
 GCFSecurityUI.verificationStatus({message:'Selection cleared. You can check another report ZIP.'});
});
$('downloadPdf').addEventListener('click',downloadHighlightedPDF);$('downloadPackage').addEventListener('click',downloadPackage);
})();
