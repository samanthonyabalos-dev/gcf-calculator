const CACHE_NAME = 'gcf-auditor-v6-partial-safe-20261024';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./sw.js','./jszip.min.js','./gcf-engine.js','./pdf-enhanced.js','./document-audit.js','./annotation-export.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // Never intercept third-party PDF.js / PDF-lib library requests with a stale HTML fallback.
  if(url.origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(error=>{
    // Only navigations can fall back to index.html; a JavaScript or PDF request must not receive HTML!
    if(event.request.mode==='navigate')return caches.match('./index.html');
    throw error;
  })));
});
