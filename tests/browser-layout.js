/* No-dependency Chromium viewport smoke test for GCF-400. */
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const binary=(()=>{for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])try{return execFileSync('which',[name],{encoding:'utf8'}).trim();}catch{}return null;})();
(async()=>{
 if(!binary){console.log('Chromium not installed; no browser-level visual layout claim.');return;}
 const server=http.createServer((req,res)=>{
  try{
   const relative=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
   const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',path.extname(file)==='.js'?'application/javascript':path.extname(file)==='.html'?'text/html':'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(e){res.writeHead(500);res.end('Server error');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'gcf-layout-'));
 const proc=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-allow-origins=*','--remote-debugging-port=9231','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  let page=null;
  for(let n=0;n<85;n++){
   try{const r=await fetch('http://127.0.0.1:9231/json/list');if(r.ok){page=(await r.json()).find(x=>x.type==='page');if(page)break;}}catch(e){}
   await wait(100);
  }
  assert.ok(page?.webSocketDebuggerUrl,'Chromium debugging endpoint unavailable');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let counter=0;const waiting=new Map();
  ws.addEventListener('message',ev=>{let obj;try{obj=JSON.parse(ev.data);}catch(e){return;}
   if(waiting.has(obj.id)){const p=waiting.get(obj.id);waiting.delete(obj.id);obj.error?p.reject(Error(obj.error.message)):p.resolve(obj.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
    setTimeout(()=>{if(waiting.has(id)){waiting.delete(id);reject(Error('CDP timeout: '+method));}},12000);
  });
  const evaluate=async expression=>{
   const response=await send('Runtime.evaluate',{expression,returnByValue:true});
   if(response.exceptionDetails)throw Error('Browser evaluation: '+response.exceptionDetails.text);
   return response.result?.value;
  };
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html'});
  for(let i=0;i<100;i++){if((await evaluate('document.readyState'))==='complete')break;await wait(90);}
  for(const width of [360,390,768,1280]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
   await wait(180);
   const values=await evaluate("(()=>{const drawer=document.querySelector('#securityDrawer');drawer.open=true;const panel=document.getElementById('deviceFingerprintPanel');panel.hidden=false;const code=document.getElementById('deviceFingerprintValue');code.textContent='abcd1234 '.repeat(8);const c=code.getBoundingClientRect(),p=panel.getBoundingClientRect();return {viewport:window.innerWidth,overflow:document.documentElement.scrollWidth-window.innerWidth,fingerprintOverflow:Math.max(0,c.right-p.right,p.left-c.left),primary:document.querySelector('.primary-task')?.getBoundingClientRect().width||0};})()");
   assert.ok(values&&values.primary>0,'Main action missing at '+width);
   assert.ok(values.overflow<=2,'Page horizontal overflow at '+width+'px: '+JSON.stringify(values));
   assert.ok(values.fingerprintOverflow<=2,'Fingerprint overflow at '+width+'px: '+JSON.stringify(values));
   console.log('Chromium layout PASS at '+width+'px; horizontal overflow '+values.overflow+'px.');
  }
 }finally{
  try{ws?.close();}catch(e){}
  proc.kill('SIGTERM');
  await new Promise(resolve=>server.close(resolve));
  try{fs.rmSync(profile,{recursive:true,force:true});}catch(e){}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
