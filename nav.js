(function(){
'use strict';
const names=['document','spreadsheet','calculator'];
function show(name){
 if(!names.includes(name))name='document';
 for(const n of names){
  const tab=document.getElementById('tab-'+n),panel=document.getElementById(n),active=n===name;
  tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.setAttribute('tabindex',active?'0':'-1');panel.hidden=!active;
 }
 if(location.hash!=='#'+name&&location.protocol!=='about:')history.replaceState(null,'','#'+name);
}
for(const n of names){
 const tab=document.getElementById('tab-'+n);
 tab.addEventListener('click',()=>show(n));
 tab.addEventListener('keydown',e=>{
  const i=names.indexOf(n),next=e.key==='ArrowRight'?names[(i+1)%names.length]:e.key==='ArrowLeft'?names[(i+names.length-1)%names.length]:e.key==='Home'?names[0]:e.key==='End'?names[names.length-1]:null;
  if(next){e.preventDefault();show(next);document.getElementById('tab-'+next).focus();}
 });
}
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
show(location.hash.slice(1));
})();
