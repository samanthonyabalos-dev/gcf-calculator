/* Real Chromium end-to-end verification: DOCX upload -> audit -> signed ZIP -> verify -> tamper rejection.
   Unlike UI mocks, this runs the actual HTML, scripts, DOM events, IndexedDB, Web Crypto and browser download. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),JSZip=require('../jszip.min.js');
const root=path.resolve(__dirname,'..'),wait=ms=>new Promise(res=>setTimeout(res,ms));
const binary=(()=>{
 for(const candidate of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])
 try{return execFileSync('which',[candidate],{encoding:'utf8'}).trim();}catch(_){}
 throw Error('Chromium browser is required for end-to-end validation');
})();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gcf-real-'));
const downloadDir=path.join(temp,'downloads');fs.mkdirSync(downloadDir);
const docxPath=path.join(temp,'GCF_Test.docx');
const tamperedZip=path.join(temp,'GCF_Changed_Report.zip');
function contentType(file){
 return {'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
}
async function makeDocx(){
 const z=new JSZip();
 z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 z.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 z.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>MONDAY, MAY 4, 2026</w:t></w:r></w:p><w:p><w:r><w:t>WEDNESDAY, MAY 5, 2026</w:t></w:r></w:p></w:body></w:document>');
 fs.writeFileSync(docxPath,await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
}
async function eventually(fn,label,tries=140){
 let latest;
 for(let i=0;i<tries;i++){
  try{latest=await fn();if(latest)return latest;}catch(e){latest=e.message;}
  await wait(100);
 }
 throw Error('Timed out waiting for '+label+'; last result='+JSON.stringify(latest));
}
(async()=>{
 await makeDocx();
 const server=http.createServer((req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1'),target=path.resolve(root,url.pathname.slice(1)||'index.html');
   if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){res.writeHead(404);res.end('Not Found');return;}
   res.setHeader('Content-Type',contentType(target));res.end(fs.readFileSync(target));
  }catch(e){res.writeHead(500);res.end('Server error');}
 });
 await new Promise(res=>server.listen(0,'127.0.0.1',res));
 const profile=path.join(temp,'profile'),debugPort=9235;
 const browser=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--remote-allow-origins=*','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let socket;
 try{
  const page=await eventually(async()=>{
   const r=await fetch('http://127.0.0.1:'+debugPort+'/json/list');
   return r.ok?(await r.json()).find(x=>x.type==='page'):null;
  },'Chrome debug endpoint');
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let counter=0;const requests=new Map();
  socket.addEventListener('message',ev=>{let data;try{data=JSON.parse(ev.data);}catch{return;}
   const cb=requests.get(data.id);if(cb){requests.delete(data.id);data.error?cb.reject(Error(data.error.message)):cb.resolve(data.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++counter;requests.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
   setTimeout(()=>{if(requests.has(id)){requests.delete(id);reject(Error('Chrome command timeout '+method));}},20000);
  });
  const evaluate=async expression=>{
   const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(r.exceptionDetails)throw Error('Browser JS: '+r.exceptionDetails.text);
   return r.result?.value;
  };
  const setFile=async(selector,file)=>{
   const d=await send('DOM.getDocument',{depth:1});
   const q=await send('DOM.querySelector',{nodeId:d.root.nodeId,selector});
   assert.ok(q.nodeId,'Input not found: '+selector);
   await send('DOM.setFileInputFiles',{nodeId:q.nodeId,files:[file]});
  };
  await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');
  await send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const targetURL=process.env.GCF_TARGET_URL||('http://127.0.0.1:'+server.address().port+'/index.html');
  console.log('Testing site:',targetURL);
  await send('Page.navigate',{url:targetURL});
  await eventually(()=>evaluate("document.readyState==='complete' && !!window.GCFSecurity && !!window.GCFWord && !!window.JSZip"),'app scripts');
  assert.ok(await evaluate("document.querySelector('header').textContent.includes('v29')"),'Must test v29 UI');
  await setFile('#files',docxPath);
  await evaluate("document.getElementById('scan').click()");
  await eventually(()=>evaluate("document.getElementById('status').textContent.includes('Scan complete')"),'completed document scan');
  const results=await evaluate("({matches:document.getElementById('statMatches').textContent,mismatches:document.getElementById('statMismatch').textContent})");
  assert.equal(results.matches,'1','Correct Monday date should match');
  assert.equal(results.mismatches,'1','Incorrect May 5 weekday should be flagged');
  await evaluate("document.getElementById('downloadPackage').click()");
  const zipPath=path.join(downloadDir,'GCF400_Audit_Reports.zip');
  await eventually(()=>fs.existsSync(zipPath)&&fs.statSync(zipPath).size>1000&&zipPath,'downloaded ZIP',200);
  const archive=await JSZip.loadAsync(fs.readFileSync(zipPath));
  assert.ok(archive.file('GCF_Findings.csv'),'Findings CSV missing');
  assert.ok(archive.file('Annotated/GCF_Test_Annotated.docx'),'Annotated document missing');
  const proof=archive.file('Verification/GCF400_Signed_Evidence.json');
  assert.ok(proof,'Automatic signed proof not included');
  const sealed=JSON.parse(await proof.async('string'));
  assert.equal(sealed.algorithm,'ECDSA-P256-SHA256');
  await setFile('#verifyEvidenceFile',zipPath);
  await setFile('#verifySourceFile',docxPath);
  await evaluate("document.getElementById('verifyEvidence').click()");
  const status=await eventually(async()=>{const s=await evaluate("document.getElementById('verifyEvidenceStatus').textContent");return s.includes('Audit proof is intact')?s:null;},'successful ZIP verification');
  const sourceStatus=await evaluate("document.getElementById('verificationSourceValue').textContent");
  assert.match(sourceStatus,/matches/i,'Original source check should pass');
  const altered=JSON.parse(JSON.stringify(sealed));altered.evidence.findings[0].status='MISMATCH';
  archive.file('Verification/GCF400_Signed_Evidence.json',JSON.stringify(altered));
  fs.writeFileSync(tamperedZip,await archive.generateAsync({type:'nodebuffer'}));
  await setFile('#verifyEvidenceFile',tamperedZip);
  await evaluate("document.getElementById('verifyEvidence').click()");
  await eventually(async()=>{const s=await evaluate("document.getElementById('verifyEvidenceStatus').textContent");return s.includes('could not be verified')?s:null;},'tampered ZIP rejection');
  console.log('CHROMIUM REAL-USER FLOW PASS: DOCX uploaded -> 1 match + 1 mismatch -> report ZIP downloaded -> signed proof included -> ZIP verification PASS with source -> altered signed findings rejected.');
 }finally{
  try{socket?.close();}catch(_){}
  browser.kill('SIGTERM');
  await new Promise(res=>server.close(res));
  try{fs.rmSync(temp,{recursive:true,force:true});}catch(_){}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
