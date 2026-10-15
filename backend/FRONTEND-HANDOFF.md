# ส่งต่อ Frontend — CampusCare

Frontend เรียก CampusCare Backend ตัวเดียว Backend ตรวจ Google/KMITL, บันทึก Supabase, เรียก AI และสร้างเสียง ห้ามส่ง service-role key หรือ AI_SERVER_API_KEY ไปหน้าเว็บ

## สิ่งที่ต้องคัดลอก

- `frontend/campuscare.ts` และ `frontend/types.ts` ไปที่โฟลเดอร์ service ของ Frontend
- `frontend/auth-callback-page.tsx` ไป `app/auth/callback/page.tsx` แล้วแก้ import ให้ตรง
- ติดตั้ง `@supabase/supabase-js`

ตั้ง `.env.local` ของ Frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=ค่าจากทีม Backend
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ค่าจากทีม Backend
NEXT_PUBLIC_CAMPUSCARE_API_URL=http://localhost:8000/campuscare
```

URL local ใช้เมื่อ Frontend และ Backend อยู่เครื่องเดียวกัน หากรันคนละเครื่อง localhost จะหมายถึงคนละเครื่อง ต้องใช้ HTTPS ที่ deploy แล้ว หรือ URL เครือข่ายของ Backend ที่ตกลงกัน พร้อมตั้ง ALLOWED_ORIGINS ให้ตรง origin ของ Frontend

เมื่อ deploy แล้วเปลี่ยน NEXT_PUBLIC_CAMPUSCARE_API_URL เป็น `https://PROJECT.supabase.co/functions/v1/campuscare` แล้ว restart/rebuild Frontend

## Dashboard

1. `signIn()` เปิด Google login; Supabase redirect ไป `/auth/callback`
2. `currentUser()` ตรวจ role; Dashboard สำหรับ `staff` บัญชีต้องอยู่ใน staff_allowlist
3. `listIssues()` คืนรายการเรียง severity สูงก่อน; severity เป็นเลข 1–5 ไม่ใช่ข้อความ high/low
4. จำนวนรายงานซ้ำต่อ issue อยู่ใน `issue.reports?.[0]?.count ?? 0`
5. `updateIssue(id,'in_progress')` หรือ `resolved` แล้วโหลดรายการใหม่
6. `dashboard('2026-10-15')` คืน counts/by_category/by_location; issue_count คือ `issues.length` ส่วน report_count อาจมากกว่าเพราะหลายคนแจ้งเรื่องเดียวกัน
7. `briefingText(date)` สำหรับข้อความ; `dailyBriefingAudio(date)` ได้ Blob ให้สร้าง object URL และเล่นหลังผู้ใช้กดปุ่ม แล้ว revoke URL เมื่อเลิกใช้

## ส่งรายงาน

สร้าง UUID ครั้งเดียวต่อรายงานและเก็บไว้เมื่อ retry → `submitReport({client_request_id:crypto.randomUUID(),description,location_id,location_text},files)` → แสดงว่ารับรายงานแล้ว → `processReport(id)` → โหลด `getReport(id)` ใหม่

การส่งรายงานกับประมวลผลแยกกันโดยตั้งใจ ถ้า AI ตอบ 502 อย่าสร้างรายงานใหม่ ให้แสดง pending/failed แล้วมีปุ่ม retry `processReport(id)` หากอัปโหลดไฟล์บางไฟล์ล้มเหลว อย่าเรียก submitReport พร้อมไฟล์เดิมทั้งหมดซ้ำโดยอัตโนมัติ ให้ retry เฉพาะไฟล์ที่ยังไม่ได้อัปโหลด

เสียง: ใช้ MediaRecorder บันทึกเป็น File ส่งผ่าน attachments ไม่ต้องมีรูปหรือข้อความ; Backend ถอดเสียงด้วย ElevenLabs เสียงยืนยัน `confirmationAudio(id)` ไม่ได้หมายความว่า AI วิเคราะห์เสร็จแล้ว

## Contract ที่ต้องตรงกัน

- category: electrical, plumbing, accessibility, cleanliness, safety, other
- issue status: open, in_progress, resolved
- AI processing status: pending, processing, completed, failed
- Google student: เลข 8 หลัก @kmitl.ac.th; เจ้าหน้าที่มาจาก allowlist
- HTTP 401: login ใหม่; 403: ไม่มีสิทธิ์; 409: มีงานประมวลผลอยู่; 502: provider ผิดพลาด; 503: server config ยังไม่ครบ
- อ้างอิง endpoints ทั้งหมดใน docs/API.md

## เปิดระบบในเครื่อง (ทีม Backend)

Terminal 1 ใน campuscare-ai: `npm.cmd run build` แล้ว `npm.cmd run start -- --hostname 127.0.0.1 --port 3001`

Terminal 2 ใน campuscare-backend: `D:\Hackathon\.tools\deno\deno.exe task dev` (port 8000)

Terminal 3: Frontend `npm.cmd run dev` (port 3000)

Backend .env ต้องมี SUPABASE_SERVICE_ROLE_KEY, AI_SERVER_URL=http://127.0.0.1:3001, ALLOW_LOCAL_AI=true และ shared AI_SERVER_API_KEY ตรงกับ AI .env.local (เตรียมไว้แล้ว) Supabase public URL ใช้ค่าที่ตั้งไว้เดิม ส่วน ELEVENLABS_API_KEY ใช้สำหรับถอดเสียง

รัน migration ใหม่ `supabase/migrations/202610150004_attachment_guard.sql` ใน SQL Editor เพียงครั้งเดียวบนฐานข้อมูลเดิม ไม่ต้องรัน setup.sql ซ้ำ

## ขอบเขตทดสอบ

Unit/contract tests และ build ไม่ใช่หลักฐานว่า OAuth, RLS, provider และฐานข้อมูลทำงานครบวงจร การทดสอบจริงต้องมี service-role key ฝั่ง Backend และนักศึกษากับเจ้าหน้าที่ล็อกอินเพื่อทดสอบสิทธิ์ตาม docs/ACCEPTANCE.md ระบบไม่สร้างบัญชี Google สมมติเพื่อข้ามการตรวจสิทธิ์
