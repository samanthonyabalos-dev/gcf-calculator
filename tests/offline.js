/* Node smoke: service worker installation/cache and browser-independent offline shell. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const handlers={},assets=new Map();
const scope='https://example.test/gcf-calculator/';
const cache={
 addAll:async entries=>{for(const name of entries)assets.set(new URL(name,scope).pathname,{ok:true,name});},
 match:async req=>assets.get(new URL(typeof req==='string'?req:req.url,scope).pathname)||null,
 put:async (req,reply)=>assets.set(new URL(req.url,scope).pathname,reply)
};
const context={self:{registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(k,fn)=>handlers[k]=fn},URL,Set,Promise,
 caches:{open:async()=>cache,keys:async()=>['gcf400-offline-v20'],delete:async()=>true},
 fetch:async()=>{throw Error('offline');}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
const task=(name,input={})=>new Promise((resolve,reject)=>{try{handlers[name]({...input,waitUntil:p=>Promise.resolve(p).then(resolve,reject)});}catch(e){reject(e);}});
(async()=>{
 await task('install');
 assert.ok(assets.has('/gcf-calculator/index.html'));
 assert.ok(assets.has('/gcf-calculator/calc-app.js'));
 assert.ok(assets.has('/gcf-calculator/offline-app.js'));
 await task('activate');
 const direct=await new Promise((resolve,reject)=>handlers.fetch({request:{method:'GET',url:scope+'index.html',mode:'navigate'},respondWith:p=>p.then(resolve,reject)}));
 assert.ok(direct);
 const fallback=await new Promise((resolve,reject)=>handlers.fetch({request:{method:'GET',url:scope+'not-found',mode:'navigate'},respondWith:p=>p.then(resolve,reject)}));
 assert.ok(fallback);
 const unknown={method:'GET',url:scope+'user-private.pdf',mode:'no-cors'};
 let intercepted=false;handlers.fetch({request:unknown,respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false,'Unknown private URLs must not be cached');
 console.log('Offline shell smoke PASS: precache, calculator, offline navigation fallback, privacy.');
})().catch(e=>{console.error(e);process.exitCode=1;});
