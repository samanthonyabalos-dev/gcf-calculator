/* Preserve original Word bytes. Audits paragraphs and table paragraphs in document.xml. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFWord=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
async function open(file){
 // Check the ZIP directory before expanding document.xml to reduce zip-bomb risk.
 const zip=await JSZip.loadAsync(file,{checkCRC32:true});
 const members=Object.values(zip.files).filter(e=>!e.dir);
 if(members.length>2500)throw Error('DOCX has too many embedded files to audit safely.');
 const entry=zip.file('word/document.xml');if(!entry)throw Error('Word document.xml not found');
 const n=entry._data?.uncompressedSize;
 if(Number.isFinite(n)&&n>12*1024*1024)throw Error('Word XML exceeds 12 MB uncompressed. Split the file.');
 const raw=await entry.async('string');
 if(raw.length>12*1024*1024)throw Error('Word XML exceeds 12 MB. Split the file.');
 // Prevent XML parser from processing document type declarations / entities.
 if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('Unsupported document XML declarations.');
 const xml=new DOMParser().parseFromString(raw,'application/xml');
 if(xml.getElementsByTagName('parsererror').length)throw Error('Invalid Word document XML');
 return {zip,xml};
}
function paragraphs(xml,file){const all=[...xml.getElementsByTagNameNS(NS,'p')],lines=[];for(let i=0;i<all.length;i++){const texts=[...all[i].getElementsByTagNameNS(NS,'t')];const txt=texts.map(t=>t.textContent).join('');if(txt.trim())lines.push({file,page:1,lineNo:i,text:txt,location:'Paragraph '+(i+1),method:'Word text',parts:[]});}return lines;}
async function read(file){
 const source=await open(file),lines=paragraphs(source.xml,file.name);
 const ignored=Object.keys(source.zip.files).filter(n=>/^word\/(?:media\/|charts\/|header\d+\.xml$|footer\d+\.xml$|footnotes\.xml$|endnotes\.xml$|comments\d*\.xml$)/i.test(n));
 const warning=ignored.length?'Manual review needed: Word contains '+ignored.length+' non-body or embedded parts (images, headers, footers, notes or charts) not examined by the date scanner.':'Word body paragraphs and tables were processed. Physical printed pages and hidden text are not certified.';
 return {file:file.name,lines,coverage:[{file:file.name,page:1,status:ignored.length?'PARTIAL':'READABLE',method:'Word body XML',nativeLines:lines.length,note:warning}],complete:ignored.length===0,scopeWarning:warning,unchecked:ignored.map(n=>({part:n,page:'embedded'}))};
}
function splitRun(node,target,color,xml){const parent=node.parentNode; if(parent.localName!=='r'||!parent.parentNode||[...parent.children].some(x=>!['rPr','t'].includes(x.localName)))return false;
 const str=node.textContent,index=str.indexOf(target);if(index<0||str.indexOf(target,index+1)!==-1)return false;
 const fragments=[str.slice(0,index),target,str.slice(index+target.length)];let anchor=parent;
 for(let i=0;i<fragments.length;i++){if(!fragments[i])continue;const newRun=parent.cloneNode(true),nt=[...newRun.getElementsByTagNameNS(NS,'t')][0];nt.textContent=fragments[i];nt.setAttribute('xml:space','preserve');let prop=[...newRun.children].find(x=>x.localName==='rPr');if(i===1){if(!prop){prop=xml.createElementNS(NS,'w:rPr');newRun.insertBefore(prop,newRun.firstChild);}for(const old of [...prop.children].filter(x=>x.localName==='highlight'))prop.removeChild(old);const hl=xml.createElementNS(NS,'w:highlight');hl.setAttributeNS(NS,'w:val',color);prop.appendChild(hl);}parent.parentNode.insertBefore(newRun,anchor.nextSibling);anchor=newRun;}
 parent.parentNode.removeChild(parent);return true;}
async function annotate(file,rows){const {zip,xml}=await open(file),paragraphs=[...xml.getElementsByTagNameNS(NS,'p')],issues=[];let highlighted=0;
 const colors={MATCH:'green',MISMATCH:'red',INVALID:'darkYellow',REVIEW:'yellow',NO_WEEKDAY:'cyan'};
 for(const [i,r] of rows.entries()){if(r.status==='NO_WEEKDAY')continue;const index=Number((r.location||'').match(/^Paragraph (\d+)/)?.[1])-1;if(!Number.isInteger(index)||!paragraphs[index]){issues.push({record:i+1,reason:'Paragraph unavailable'});continue;}const nodes=[...paragraphs[index].getElementsByTagNameNS(NS,'t')].filter(n=>n.textContent.includes(r.sourceDate));if(nodes.length!==1||!splitRun(nodes[0],r.sourceDate,colors[r.status]||'yellow',xml)){issues.push({record:i+1,date:r.sourceDate,reason:'Date spans multiple runs or location ambiguous'});continue;}highlighted++;}
 // Add separate legend page at document end after existing paragraphs, before section properties.
 const body=[...xml.getElementsByTagNameNS(NS,'body')][0];const section=[...body.children].find(n=>n.localName==='sectPr');const add=(txt,pageBreak=false)=>{const p=xml.createElementNS(NS,'w:p'),r=xml.createElementNS(NS,'w:r'),t=xml.createElementNS(NS,'w:t');if(pageBreak){const br=xml.createElementNS(NS,'w:br');br.setAttributeNS(NS,'w:type','page');r.appendChild(br);}t.textContent=txt;r.appendChild(t);p.appendChild(r);body.insertBefore(p,section||null);};
 add('GCF-400 — DOCUMENT AUDIT LEGEND',true);add('Green: weekday match | Red: mismatch | Orange: invalid | Yellow: review | Blue: date without weekday');add(`${rows.length} findings • ${highlighted} highlighted • ${issues.length} unresolved date positions`);add('Source words and tables are preserved; this only checks date–weekday consistency.');
 zip.file('word/document.xml',new XMLSerializer().serializeToString(xml),{createFolders:false});return {blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'}),highlighted,issues};}
return {read,annotate};
});
