import { bangkokDayBounds, briefingText, validateAssessment } from './domain.ts';
function assert(value: unknown) { if(!value) throw new Error('Assertion failed'); }
function rejects(fn:()=>unknown) {let thrown=false;try{fn();}catch{thrown=true;}assert(thrown);}
const valid={title:'ลิฟต์เสีย',category:'accessibility',severity:4,location_text:'อาคาร A',duplicate_issue_id:null,duplicate_confidence:0};
Deno.test('AI rejects fabricated duplicates and invalid priorities',()=>{
  assert(validateAssessment(valid,[]).severity===4);
  rejects(()=>validateAssessment({...valid,severity:6},[]));
  rejects(()=>validateAssessment({...valid,severity:1.5},[]));
  rejects(()=>validateAssessment({...valid,duplicate_issue_id:'invented',duplicate_confidence:1},[]));
  rejects(()=>validateAssessment({...valid,duplicate_confidence:NaN},[]));
  assert(validateAssessment({...valid,duplicate_issue_id:'candidate',duplicate_confidence:0.96},['candidate']).duplicate_issue_id==='candidate');
});
Deno.test('Bangkok daily boundaries include the preceding UTC date',()=>{
  const bounds=bangkokDayBounds('2026-10-15');
  assert(bounds.start==='2026-10-14T17:00:00.000Z');assert(bounds.end==='2026-10-15T17:00:00.000Z');
  rejects(()=>bangkokDayBounds('2026-02-30'));rejects(()=>bangkokDayBounds('15/10/2026'));
});
Deno.test('briefing separates reports, issues, and current backlog',()=>{
  const result=briefingText([{severity:5,status:'open',category:'safety'}],5,12,'2026-10-15');
  assert(result.includes('5 รายงาน'));assert(result.includes('1 ปัญหา'));assert(result.includes('12 ปัญหา'));
});
