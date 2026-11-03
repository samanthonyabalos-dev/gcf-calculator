/* GCF-400 v21 scoped app-shell cache. Never cache user uploads or external origins. */
'use strict';
const CACHE='gcf400-offline-v26-20261103';
const CORE=['./','./index.html','./calculator.html','./mathematics-reference.html','./gcf-engine.js','./scan-core.js','./pdf-bridge.js','./document-bridge.js','./pdf-export.js','./audit-utils.js','./security-seal.js','./security-ui.js','./audit-app.js','./quality-app.js','./sheet-app.js','./calc-app.js','./learn-app.js','./nav.js','./offline-app.js','./quick-verify.js','./jszip.min.js','./manifest.webmanifest','./icon.svg'];
const allowed=new Set(CORE.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('gcf400-')&&name!==CACHE).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const isShell=allowed.has(url.pathname);
 if(!isShell&&request.mode!=='navigate')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const existing=isShell?await cache.match(request,{ignoreSearch:true}):null;
  if(existing)return existing;
  try{
   const response=await fetch(request);
   if(response.ok&&isShell)await cache.put(request,response.clone());
   return response;
  }catch(error){
   if(request.mode==='navigate'){
    const fallback=await cache.match(new URL('./index.html',self.registration.scope).href);
    if(fallback)return fallback;
   }
   throw error;
  }
 })());
});
