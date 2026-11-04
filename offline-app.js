/* GCF-400 v21 — genuine offline readiness, install guidance and calculator smoke. */
(function(){'use strict';
const status=document.getElementById('offlineStatus'),details=document.getElementById('offlineDetails'),checkButton=document.getElementById('offlineCheck'),installButton=document.getElementById('offlineInstall');
const essentials=['./index.html','./gcf-engine.js','./calc-app.js','./nav.js','./offline-app.js'];
const updateButton=document.getElementById('offlineApplyUpdate');
const cacheName='gcf400-offline-v28-20261104';
let ready=false,promptEvent=null,checking=false;
function show(message,kind='info'){
 if(status){status.textContent=message;status.dataset.state=kind;}
 if(details)details.textContent=navigator.onLine?'Network reports online. PDF OCR may require libraries that have not been downloaded.':'Network reports offline. The calendar calculator and bundled learning tools do not need external libraries.';
}
async function verify(){
 if(!('serviceWorker' in navigator)||!('caches' in window))return {ready:false,reason:'Your browser does not support offline installation. The calculator still works while this page stays open.'};
 try{
  const cache=await caches.open(cacheName);
  const present=await Promise.all(essentials.map(async p=>Boolean(await cache.match(new URL(p,location.href).href))));
  const correct=window.GCFEngine?.gcf400(2026,5,4)===1;
  return {ready:present.every(Boolean)&&correct,missing:essentials.filter((_,i)=>!present[i]),reason:correct?'Required files are not yet fully cached.':'The weekday self-check failed.'};
 }catch(e){return {ready:false,reason:'Offline verification error: '+e.message};}
}
async function checkOffline({register=true}={}){
 if(checking)return;
 checking=true;if(checkButton)checkButton.disabled=true;
 show('Checking offline calculator installation…');
 try{
  if(register&&'serviceWorker' in navigator){
   const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
   if(navigator.onLine)reg.update().catch(()=>{});
   await navigator.serviceWorker.ready;
   if(reg.installing)await new Promise(resolve=>{const w=reg.installing;const done=()=>{if(w.state==='activated'||w.state==='redundant')resolve();};w.addEventListener('statechange',done);done();});
  }
  const result=await verify();
  ready=result.ready;
  if(ready)show(navigator.onLine?'Offline calculator installed and verified.':'Offline mode active — calculator ready.','success');
  else show(result.reason+(result.missing?.length?' Missing: '+result.missing.join(', '):''),'warning');
 }catch(e){ready=false;show('Offline installation unavailable: '+e.message,'warning');}
 finally{checking=false;if(checkButton)checkButton.disabled=false;}
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;if(installButton)installButton.hidden=false;});
if(installButton)installButton.addEventListener('click',async()=>{
 if(!promptEvent){show('Use your browser menu and choose Install app or Add to Home Screen.','info');return;}
 const e=promptEvent;promptEvent=null;await e.prompt();if(installButton)installButton.hidden=true;
});
if(checkButton)checkButton.addEventListener('click',()=>checkOffline());
window.addEventListener('online',()=>show(ready?'Offline calculator installed and verified.':'Connected — verify offline installation.',ready?'success':'info'));
window.addEventListener('offline',()=>show(ready?'Offline mode active — calculator ready.':'Offline; caching was not verified.',ready?'success':'warning'));
if('serviceWorker' in navigator){
 let alreadyControlled=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!alreadyControlled){alreadyControlled=true;return;}
  show('A newer GCF-400 version is ready. Choose “Load updated app” to use the latest page.','warning');
  if(updateButton)updateButton.hidden=false;
 });
}
if(updateButton)updateButton.addEventListener('click',()=>window.location.reload());
window.addEventListener('load',()=>checkOffline());
window.GCFOffline={verify,checkOffline};
})();