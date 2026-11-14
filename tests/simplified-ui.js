/* GCF-400 v28: protect the task-first user interface from re-cluttering. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../audit-app.js'),'utf8');
const sheet=fs.readFileSync(path.join(__dirname,'../sheet-app.js'),'utf8');
const quick=fs.readFileSync(path.join(__dirname,'../quick-verify.js'),'utf8');
const at=id=>html.indexOf('id="'+id+'"');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8'));
assert.ok(manifest.name.includes('GCF Auditor')&&manifest.name.includes('Date–Weekday Checker'),'Installed app full name must describe its purpose');
assert.equal(manifest.short_name,'GCF Date–Weekday','Home-screen shortcut must show the date-weekday purpose');
assert.ok(html.includes('<h1>GCF Auditor<span class="brand-colon">:</span><span class="brand-descriptor"> Date–Weekday Checker</span></h1>'),'App title and purpose must be clearly visible');
assert.ok(/<img[^>]+class="brand-logo"[^>]+src="\.\/icon\.svg"/.test(html),'Existing calendar logo must appear next to the app title');
assert.ok(!html.includes('Upload a file or check a date in seconds.'),'Avoid redundant marketing instructions above primary tasks');

const uniq=id=>assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'Control '+id+' must exist once');
for(const id of ['files','scan','reading','ocr','order','results','statMismatch','statReview','statMatches','statDateOnly','statDates','statPages','runSelfChecks','selfCheckResults','downloadPdf','downloadSignedManifest','downloadManifest','downloadRecords','downloadEvidence','downloadCoverage','downloadPackage','deviceSignerStatus','deviceFingerprintValue','verifyEvidenceFile','verifySourceFile','trustedKeyFingerprint','verifyEvidence','sheetFile','sheetScan','sheetOrder','sheetSample','sheetExcel','sheetExport','sheetFlagged','calcRun','calcExample','calcToday','calcCopy','calcFormula','calcCache','quickInput','quickCheck','learnGCFButton'])uniq(id);
assert.ok(at('files')<at('scan')&&at('scan')<at('securityDrawer')&&at('securityDrawer')<at('results'),'Primary document scan must precede optional security tools and results');
assert.ok(at('developerChecks')>at('results'),'Testing tools must not appear before the main results');
assert.ok(at('statMismatch')>at('results'),'Status legend belongs with results, not ahead of the scan');
assert.ok(html.includes('<details class="scan-options"'),'Advanced scan controls should be collapsed initially');
assert.ok(html.includes('<details class="card tool-drawer" id="securityDrawer"'),'Security must be collapsible');
assert.ok(!html.includes('<details class="card tool-drawer" id="securityDrawer" open'),'Security should start collapsed');
assert.ok(html.includes('<details class="results-technical"'),'Scan diagnostics should be collapsed');
assert.ok(html.includes('<details class="export-more"'),'Secondary export options should be collapsed');
assert.ok(html.includes('<details class="calc-breakdown"'),'Math detail should be collapsed');
assert.ok(!html.includes('Run 298 logic checks, including'),'Technical test descriptions should not dominate first-use screens');
assert.ok(!html.includes('A color indicates what the auditor found'),'Lengthy legend text should be removed from first-use screens');
assert.ok(html.includes('id="offlineStatus"')&&html.includes('id="offlineCheck"'),'Offline access must remain');
assert.ok(app.includes('auditHeadline'),'Scan outcomes should show the next action');
assert.ok(app.includes("scrollIntoView?.({behavior:'smooth',block:'start'})"),'Scan results should be revealed automatically');
assert.ok(sheet.includes("Checked ${result.results.length.toLocaleString()} rows"),'Spreadsheet feedback should be concise');
assert.ok(!quick.includes('This verifies weekday consistency, not the authenticity of a schedule.'),'Quick checks should not repeat paragraphs');
for(const tag of ['section','details','div','main','header','nav']){
 const openings=(html.match(new RegExp('<'+tag+'(?:[\\s>])','g'))||[]).length;
 const closings=(html.match(new RegExp('</'+tag+'\\s*>','g'))||[]).length;
 assert.equal(openings,closings,tag+' elements should have balanced closures');
}
console.log('GCF-400 usability structure PASS: primary tasks first, preserved controls, collapsed advanced UI, balanced markup.');
