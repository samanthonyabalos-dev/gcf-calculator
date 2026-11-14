/* Regression: offline verification must not depend on a stale hard-coded cache version. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const scope='https://example.test/gcf-calculator/';
const essentials=['index.html','gcf-engine.js','calc-app.js','nav.js','offline-app.js'];
const cacheEntries=new Map([
 ['gcf400-offline-v29-20261110',new Set()],
 ['gcf400-offline-v29-licenses-20261114',new Set(essentials)]
]);
const listeners=new Map();
const elements=new Map();
const element=id=>{
 if(!elements.has(id))elements.set(id,{
  hidden:false,disabled:false,textContent:'',dataset:{},addEventListener:()=>{}
 });
 return elements.get(id);
};
const serviceWorker={addEventListener:()=>{},controller:null};
const context={
 URL,Promise,
 navigator:{onLine:true,serviceWorker},
 location:{href:scope+'index.html'},
 document:{getElementById:element},
 caches:{
  keys:async()=>[...cacheEntries.keys()],
  open:async name=>{
   assert.ok(cacheEntries.has(name),'Verification must never create a guessed cache: '+name);
   return {match:async url=>cacheEntries.get(name).has(new URL(url).pathname.split('/').pop())?{ok:true}:undefined};
  }
 },
 window:{
  GCFEngine:{gcf400:(y,m,d)=>y===2026&&m===5&&d===4?1:0},
  addEventListener:(name,fn)=>listeners.set(name,fn)
 },
 console
};
context.window.caches=context.caches;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../offline-app.js'),'utf8'),context);
(async()=>{
 const checker=context.window.GCFOffline.verify;
 let result=await checker();
 assert.equal(result.ready,true,'Current installed offline cache should pass despite an old empty cache');
 assert.equal(result.missing.length,0,'No essential files are actually missing');
 cacheEntries.get('gcf400-offline-v29-licenses-20261114').delete('nav.js');
 result=await checker();
 assert.equal(result.ready,false,'Missing essential file must fail offline readiness');
 assert.deepEqual([...result.missing],['./nav.js'],'Only nav.js should be listed as missing');
 cacheEntries.get('gcf400-offline-v29-licenses-20261114').add('nav.js');
 cacheEntries.delete('gcf400-offline-v29-20261110');
 result=await checker();
 assert.equal(result.ready,true,'Offline cache discovery must work after old versions are deleted');
 assert.ok(!fs.readFileSync(path.join(__dirname,'../offline-app.js'),'utf8').includes("caches.open(cacheName)"),'Never open a guessed cache');
 console.log('Offline cache verification PASS: stale empty cache ignored, current files detected, true missing file reported.');
})().catch(e=>{console.error(e);process.exitCode=1;});
