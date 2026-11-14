/* GCF-400 v29 scoped offline shell: online navigation is network-first to prevent stale UI. */
'use strict';
const CACHE='gcf400-offline-v29-cachefix-20261114';
const CORE=['./','./index.html','./calculator.html','./mathematics-reference.html','./gcf-engine.js','./scan-core.js','./pdf-bridge.js','./document-bridge.js','./pdf-export.js','./audit-utils.js','./security-seal.js','./security-ui.js','./audit-app.js','./quality-app.js','./sheet-app.js','./calc-app.js','./learn-app.js','./nav.js','./offline-app.js','./quick-verify.js','./jszip.min.js','./open-source-licenses.html','./THIRD_PARTY_NOTICES.md','./licenses/JSZIP-MIT.txt','./licenses/APACHE-2.0.txt','./licenses/PDF-LIB-MIT.txt','./licenses/PAKO-MIT.txt','./licenses/LIE-MIT.txt','./licenses/IMMEDIATE-MIT.txt','./licenses/SETIMMEDIATE-MIT.txt','./licenses/READABLE-STREAM.txt','./manifest.webmanifest','./icon.svg'];
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
 if(request.mode==='navigate'){
  // Always revalidate the page online. Old cache-first HTML caused outdated signing UI.
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const fresh=await fetch(request,{cache:'no-store'});
    if(fresh.ok&&isShell)await cache.put(request,fresh.clone());
    return fresh;
   }catch(error){
    const fallback=await cache.match(request,{ignoreSearch:true})||
      await cache.match(new URL('./index.html',self.registration.scope).href);
    if(fallback)return fallback;
    throw error;
   }
  })());
  return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const existing=await cache.match(request,{ignoreSearch:true});
  if(existing)return existing;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());
  return response;
 })());
});
