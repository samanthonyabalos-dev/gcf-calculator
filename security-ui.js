/* GCF-400 v26 · readable, accessible security status formatting.
 * Render every fingerprint using textContent, never HTML from uploaded data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCFSecurityUI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FINGERPRINT=/^[0-9a-f]{64}$/i;
 const formatFingerprint=value=>{
  const fp=String(value||'').trim();
  return FINGERPRINT.test(fp)?fp.toLowerCase().match(/.{8}/g).join(' '):'';
 };
 const get=id=>typeof document==='undefined'?null:document.getElementById(id);
 const hide=(id,hidden)=>{const el=get(id);if(el)el.hidden=!!hidden;};
 function keyStatus({message='',fingerprint='',state='info'}={}){
  const status=get('deviceSignerStatus');
  if(status){status.textContent=String(message);status.dataset.state=state;}
  const formatted=formatFingerprint(fingerprint);
  const code=get('deviceFingerprintValue');
  if(code)code.textContent=formatted;
  hide('deviceFingerprintPanel',!formatted);
  const copy=get('copyDeviceFingerprint');
  if(copy){copy.disabled=!formatted;copy.dataset.value=formatted?fingerprint.toLowerCase():'';}
 }
 function verificationStatus({message='',fingerprint='',digest='',state='info',sourceResult='',trustResult=''}={}){
  const status=get('verifyEvidenceStatus');
  if(status){status.textContent=String(message);status.dataset.state=state;}
  const formatted=formatFingerprint(fingerprint);
  const code=get('verificationFingerprintValue');
  if(code)code.textContent=formatted;
  hide('verificationDetails',!formatted);
  const hash=get('verificationHashValue');
  if(hash)hash.textContent=formatFingerprint(digest)||String(digest||'Unavailable');
  const source=get('verificationSourceValue');
  if(source)source.textContent=String(sourceResult||'Not supplied');
  const trusted=get('verificationTrustValue');
  if(trusted)trusted.textContent=String(trustResult||'No independently trusted key supplied');
 }
 async function copyFingerprint(){
  const button=get('copyDeviceFingerprint'),fp=button?.dataset.value||'';
  if(!FINGERPRINT.test(fp)){keyStatus({message:'No valid fingerprint is available to copy.',state:'warning'});return false;}
  try{
   if(typeof navigator==='undefined'||!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(fp);
   const feedback=get('deviceCopyStatus');
   if(feedback)feedback.textContent='Fingerprint copied (64 characters).';
   return true;
  }catch(e){
   const feedback=get('deviceCopyStatus');
   if(feedback)feedback.textContent='Could not access the clipboard. Select the displayed fingerprint and copy it manually.';
   return false;
  }
 }
 return {formatFingerprint,keyStatus,verificationStatus,copyFingerprint};
});