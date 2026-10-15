export const categories = ['electrical','plumbing','accessibility','cleanliness','safety','other'] as const;
export function validateAssessment(value: unknown, candidateIds: string[]) {
  if (!value || typeof value !== 'object') throw new Error('Invalid AI result');
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.length > 200 ||
      !categories.includes(v.category as typeof categories[number]) ||
      !Number.isInteger(v.severity) || Number(v.severity) < 1 || Number(v.severity) > 5 ||
      typeof v.location_text !== 'string' || v.location_text.length > 300 ||
      typeof v.duplicate_confidence !== 'number' || !Number.isFinite(v.duplicate_confidence) ||
      v.duplicate_confidence < 0 || v.duplicate_confidence > 1 ||
      (v.duplicate_issue_id !== null && (typeof v.duplicate_issue_id !== 'string' || !candidateIds.includes(v.duplicate_issue_id)))) {
    throw new Error('Invalid AI result');
  }
  // Retain only approved structured fields; never persist provider payloads or instructions.
  return { title: v.title.trim(), category: v.category, severity: v.severity,
    location_text: v.location_text, duplicate_issue_id: v.duplicate_issue_id,
    duplicate_confidence: v.duplicate_confidence };
}
export function bangkokDayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  const start = new Date(`${date}T00:00:00+07:00`);
  if (!Number.isFinite(start.getTime()) || new Date(start.getTime()+7*3600000).toISOString().slice(0,10)!==date) throw new Error('Invalid date');
  return { start: start.toISOString(), end: new Date(start.getTime()+86400000).toISOString() };
}
export function briefingText(rows: { severity: number; status: string; category: string }[], reports: number, backlog: number, date: string) {
  const urgent=rows.filter(r=>r.severity>=4).length;
  const resolved=rows.filter(r=>r.status==='resolved').length;
  return `สรุปสถานการณ์มหาวิทยาลัยประจำวันที่ ${date} มีรายงานใหม่ ${reports} รายงาน พบปัญหาใหม่ ${rows.length} ปัญหา ในจำนวนนี้มีความรุนแรงสูง ${urgent} ปัญหา และแก้ไขแล้ว ${resolved} ปัญหา ขณะนี้มีปัญหาที่ยังไม่ปิดทั้งหมด ${backlog} ปัญหา กรุณาตรวจสอบปัญหาความรุนแรงสูงก่อน`;
}
