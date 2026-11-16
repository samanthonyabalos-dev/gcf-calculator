/* Regress the mobile preview tooltip's horizontal placement.
   Uses the actual placement helper from audit-app.js. No PDF fixtures needed. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const audit=fs.readFileSync(path.join(__dirname,'../audit-app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=audit.indexOf('function mobileTooltipPlacement(');
const end=audit.indexOf('\nfunction drawPreviewOverlays(',start);
assert.ok(start>=0&&end>start,'Mobile tooltip placement helper must exist');
const place=new Function(audit.slice(start,end)+';return mobileTooltipPlacement;')();
assert.match(audit,/window\.matchMedia\?\.\('\(max-width:720px\)'\)\.matches/,'Positioning must apply only to mobile');
assert.ok(html.includes('.pdf-tooltip-right .pdf-tooltip{left:auto;right:0}'),'Original desktop tooltip rule must remain');
assert.ok(html.includes('@media(max-width:720px){.pdf-tooltip{min-width:0'),'Mobile popup must permit width smaller than its desktop minimum');
let checks=0;
for(const stage of [260,280,300,330,375,420,650]){
 for(const anchorLeft of [0,3,8,26,stage/4,stage/2,stage-42,stage-12]){
  for(const width of [5,18,40]){
   const tip=place(anchorLeft,width,stage);
   const left=anchorLeft+tip.left,right=left+tip.width;
   assert.ok(left>=7.99&&right<=stage-7.99,
     'Tooltip clipped at '+JSON.stringify({stage,anchorLeft,width,tip,left,right}));
   assert.ok(tip.width>0&&tip.width<=300,'Tooltip width unexpected');
   checks++;
  }
 }
}
const nearLeft=place(20,14,280),nearRight=place(250,12,280);
assert.ok(nearLeft.left<0,'Left edge must shift tooltip left relative to a mark when needed');
assert.ok(nearRight.left<0,'Right edge should shift popup back toward the preview');
console.log('Mobile PDF tooltip bounds PASS: '+checks+' placements, 260–650px viewports, edge anchors, desktop CSS preserved.');
