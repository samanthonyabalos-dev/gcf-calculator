/* PRC source-derived text fixtures — verified against PRC-hosted PDF text as of 2026-10-31.
 * These do not prove browser PDF extraction/OCR completeness or PDF annotation quality.
 * Each case is copied from a documented schedule line and its result is independently calendar-checked.
 */
'use strict';
const assert=require('node:assert/strict');
globalThis.GCFEngine=require('../gcf-engine.js');
const scanner=require('../scan-core.js');
const examples=[
  {
    "label": "Dentists written May 2026",
    "text": "MONDAY, MAY 4, 2026",
    "status": "MATCH",
    "expected": "Monday",
    "url": "https://www.prc.gov.ph/sites/default/files/Revised%20May%202026%20DLE%20Written%20Phase%20Program.pdf"
  },
  {
    "label": "Dentists written May 2026",
    "text": "TUESDAY, MAY 5, 2026",
    "status": "MATCH",
    "expected": "Tuesday",
    "url": "https://www.prc.gov.ph/sites/default/files/Revised%20May%202026%20DLE%20Written%20Phase%20Program.pdf"
  },
  {
    "label": "Dentists written May 2026",
    "text": "WEDNESDAY, MAY 6, 2026",
    "status": "MATCH",
    "expected": "Wednesday",
    "url": "https://www.prc.gov.ph/sites/default/files/Revised%20May%202026%20DLE%20Written%20Phase%20Program.pdf"
  },
  {
    "label": "Civil Engineers March 2026",
    "text": "THURSDAY, MARCH 26, 2026",
    "status": "MATCH",
    "expected": "Thursday",
    "url": "https://www.prc.gov.ph/sites/default/files/RevisedExamProgramMarch2026CivilEngg.pdf"
  },
  {
    "label": "Civil Engineers March 2026",
    "text": "FRIDAY, MARCH 27, 2026",
    "status": "MATCH",
    "expected": "Friday",
    "url": "https://www.prc.gov.ph/sites/default/files/RevisedExamProgramMarch2026CivilEngg.pdf"
  },
  {
    "label": "CPALE May 2026",
    "text": "SUNDAY, MAY 24, 2026",
    "status": "MATCH",
    "expected": "Sunday",
    "url": "https://www.prc.gov.ph/sites/default/files/Board%20Program%20May%202026%20CPALE_revised.pdf"
  },
  {
    "label": "CPALE May 2026",
    "text": "MONDAY, MAY 25, 2026",
    "status": "MATCH",
    "expected": "Monday",
    "url": "https://www.prc.gov.ph/sites/default/files/Board%20Program%20May%202026%20CPALE_revised.pdf"
  },
  {
    "label": "CPALE May 2026",
    "text": "TUESDAY, MAY 26, 2026",
    "status": "MATCH",
    "expected": "Tuesday",
    "url": "https://www.prc.gov.ph/sites/default/files/Board%20Program%20May%202026%20CPALE_revised.pdf"
  },
  {
    "label": "Dental Hygienists May 2026",
    "text": "THURSDAY, MAY 7, 2026",
    "status": "MATCH",
    "expected": "Thursday",
    "url": "https://www.prc.gov.ph/sites/default/files/Revised%20May%202026%20DHLE%20Program.pdf"
  },
  {
    "label": "Dental Hygienists May 2026",
    "text": "FRIDAY, MAY 8, 2026",
    "status": "MATCH",
    "expected": "Friday",
    "url": "https://www.prc.gov.ph/sites/default/files/Revised%20May%202026%20DHLE%20Program.pdf"
  },
  {
    "label": "Medical Technologists March 2026",
    "text": "THURSDAY, MARCH 5, 2026",
    "status": "MATCH",
    "expected": "Thursday",
    "url": "https://www.prc.gov.ph/sites/default/files/March%202026%20MTLE%20Program.pdf"
  },
  {
    "label": "Medical Technologists March 2026",
    "text": "FRIDAY, MARCH 6, 2026",
    "status": "MATCH",
    "expected": "Friday",
    "url": "https://www.prc.gov.ph/sites/default/files/March%202026%20MTLE%20Program.pdf"
  },
  {
    "label": "Mechanical Engineers February 2026",
    "text": "WEDNESDAY, FEB. 11, 2026",
    "status": "MATCH",
    "expected": "Wednesday",
    "url": "https://www.prc.gov.ph/sites/default/files/exam%20program%20feb%202026%20mele.pdf"
  },
  {
    "label": "Mechanical Engineers February 2026",
    "text": "THURSDAY, FEB. 12, 2026",
    "status": "MATCH",
    "expected": "Thursday",
    "url": "https://www.prc.gov.ph/sites/default/files/exam%20program%20feb%202026%20mele.pdf"
  },
  {
    "label": "Mechanical Engineers February 2026",
    "text": "FRIDAY, FEB. 13, 2026",
    "status": "MATCH",
    "expected": "Friday",
    "url": "https://www.prc.gov.ph/sites/default/files/exam%20program%20feb%202026%20mele.pdf"
  },
  {
    "label": "Architects program January 2026",
    "text": "TUESDAY, JANUARY 20, 2026",
    "status": "MATCH",
    "expected": "Tuesday",
    "url": "https://www.prc.gov.ph/sites/default/files/January%202026%20Examination%20Program%20for%20Architects_rev.pdf"
  },
  {
    "label": "Architects program January 2026",
    "text": "THURSDAY, JANUARY 22, 2026",
    "status": "MATCH",
    "expected": "Thursday",
    "url": "https://www.prc.gov.ph/sites/default/files/January%202026%20Examination%20Program%20for%20Architects_rev.pdf"
  },
  {
    "label": "Architects RO I January 2026",
    "text": "THURSDAY, JANUARY 22, 2025",
    "status": "MISMATCH",
    "expected": "Wednesday",
    "url": "https://www.prc.gov.ph/sites/default/files/RA_JANUARY%202026%20ARCHITECTS%20LE_RO%201_ROSALES.pdf"
  },
  {
    "label": "Dentists November 2025",
    "text": "MONDAY, NOVEMBER 24, 2025",
    "status": "MATCH",
    "expected": "Monday",
    "url": "https://www.prc.gov.ph/sites/default/files/Nov%202025%20DLE%20Program%20of%20Exam%20Written.pdf"
  },
  {
    "label": "Dentists November 2025",
    "text": "TUESDAY, NOVEMBER 25, 2025",
    "status": "MATCH",
    "expected": "Tuesday",
    "url": "https://www.prc.gov.ph/sites/default/files/Nov%202025%20DLE%20Program%20of%20Exam%20Written.pdf"
  },
  {
    "label": "Dentists November 2025",
    "text": "WEDNESDAY, NOVEMBER 26, 2025",
    "status": "MATCH",
    "expected": "Wednesday",
    "url": "https://www.prc.gov.ph/sites/default/files/Nov%202025%20DLE%20Program%20of%20Exam%20Written.pdf"
  }
];
for(const [i,t] of examples.entries()){
 const line={file:t.label,page:1,lineNo:0,text:t.text,method:'PRC text fixture',parts:[]};
 const findings=scanner.scanPage([line],{reading:'auto',order:'auto'});
 assert.equal(findings.length,1,'Expected exactly one finding for '+t.label+' #'+i);
 const actual=findings[0];
 assert.equal(actual.status,t.status,'Status incorrect for '+t.label+': '+t.text);
 assert.equal(actual.expected,t.expected,'Weekday incorrect for '+t.label+': '+t.text);
}
const yearIssue=examples.find(t=>t.status==='MISMATCH');
assert.ok(yearIssue&&yearIssue.text.includes('2025'));
assert.equal(new Date(Date.UTC(2025,0,22)).getUTCDay(),3,'2025-01-22 must be Wednesday');
assert.equal(new Date(Date.UTC(2026,0,22)).getUTCDay(),4,'2026-01-22 must be Thursday');
console.log('PRC source-derived regression: '+examples.length+'/'+examples.length+' expected status and weekday cases passed across '+new Set(examples.map(x=>x.label)).size+' document groups.');
console.log('Limitation: source-derived strings only; real PDF.js text spans and OCR must be tested separately.');
