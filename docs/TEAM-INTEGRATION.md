# ส่งต่อ Backend + AI ให้ Frontend

Branch: `backend-ai-integration`. โค้ด Frontend อยู่ที่ root/src ตามเดิม เพิ่ม Backend ใน `backend/` และ Next.js AI service ใน `ai-server/` แต่ละโปรเจกต์รันแยกกัน

```text
Frontend :3000 → Backend :8000/campuscare → AI service :3001
                         ↓
                   Supabase Auth/DB/Storage
```

## ดึงโค้ด

```powershell
git fetch origin
git switch backend-ai-integration
```

หากมีงาน Frontend ที่ยังไม่ commit ให้เก็บงานก่อน switch หรือใช้ checkout แยก ห้าม reset งานที่ค้าง

## ตั้งค่าแต่ละโปรเจกต์

1. คัดลอก `backend/.env.example` เป็น `backend/.env` และ `ai-server/.env.example` เป็น `ai-server/.env.local` กรอกค่าจริงผ่านช่องทางส่วนตัวของทีม ไม่มี keys จริงใน repository
2. Backend: ตั้ง NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS=http://localhost:3000, AI_SERVER_URL=http://127.0.0.1:3001, ALLOW_LOCAL_AI=true และ ELEVENLABS_API_KEY สำหรับถอดเสียง
3. ตั้ง AI_SERVER_API_KEY เป็น secret เดียวกันในทั้งสองไฟล์ ส่วน Gemini/ElevenLabs keys และ voice ID อยู่ใน ai-server/.env.local ด้วย GEMINI_MODEL ต้องเป็นโมเดลที่บัญชี generateContent ได้จริง
4. Frontend root `.env.local` ใช้เฉพาะ public values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
NEXT_PUBLIC_CAMPUSCARE_API_URL=http://localhost:8000/campuscare
```

ห้ามใส่ service-role หรือ AI shared secret ใน NEXT_PUBLIC variables

## เปิดระบบ

Terminal AI:

```powershell
cd ai-server
npm.cmd ci
npm.cmd run dev -- --port 3001
```

Terminal Backend (ติดตั้ง Deno ก่อน):

```powershell
cd backend
deno task dev
```

Terminal Frontend ที่ root:

```powershell
npm.cmd ci
npm.cmd run dev
```

localhost ใช้ได้เมื่อรันบนเครื่องเดียวกัน หาก Frontend รันอีกเครื่อง ต้องใช้ backend URL ที่เข้าถึงได้จริงและเพิ่ม origin ใน ALLOWED_ORIGINS การตั้ง CORS ไม่ได้แทนการล็อกอิน

## เชื่อม Frontend

- คัดลอก `backend/frontend/campuscare.ts` และ `types.ts` ไปโฟลเดอร์ service ของ Frontend ให้ import ทั้งสองไฟล์สัมพันธ์กัน
- ทำหน้า `/auth/callback` จาก `backend/frontend/auth-callback-page.tsx` และแก้ import
- Login: signIn() → currentUser(); Dashboard ต้อง role=staff
- Dashboard: listIssues(), dashboard(date), updateIssue(id,status), briefingText(date), dailyBriefingAudio(date)
- Voice/text: submitReport(input,files) → แสดงรับรายงาน → processReport(id) → getReport(id)
- สถานะ AI failed ให้ retry รายงานเดิม ไม่สร้างรายงานซ้ำ และเสียงล้มเหลวต้องไม่ลบรายงานที่บันทึกแล้ว
- รายละเอียด [API contract](../backend/docs/API.md) และ [Frontend handoff](../backend/FRONTEND-HANDOFF.md)

## Supabase

- Project ที่สร้างตารางไว้แล้ว: รันเฉพาะ `backend/supabase/migrations/202610150004_attachment_guard.sql` ครั้งเดียว ไม่รัน setup.sql ซ้ำ
- Project ใหม่: รัน migrations 001,002,003,004 ตามลำดับ
- Google provider, Before User Created hook และ redirect URL ต้องตั้งใน Dashboard ของ project
- เพิ่มบัญชีเจ้าหน้าที่จริงใน staff_allowlist จาก SQL Editor

## ทดสอบและข้อจำกัดที่ยังค้าง

```powershell
# ใน backend/
deno task test
deno task check
# ใน ai-server/
node --test scripts/auth.test.mjs
npm.cmd run lint
npm.cmd run build
# มี server รันและ env จริงแล้ว คำสั่งนี้ใช้เครดิต provider
node --env-file=.env.local scripts/smoke.mjs
```

ตรวจในเครื่องผู้พัฒนาแล้ว: Backend tests 10 ชุดผ่าน, AI auth test ผ่าน, AI lint/build ผ่าน, ElevenLabs TTS จริงผ่าน ระบบ anonymous/CORS ตรวจแล้ว

ยังไม่ยืนยันครบวงจร: Gemini ตอบ 503/timeout ในการทดสอบล่าสุด, service-role key ยังไม่ได้ตั้งสำหรับทดสอบ transaction จริง, migration 004 ยังไม่ได้รันบนฐานข้อมูล hosted และยังไม่ได้ deploy services ดู [บันทึกทดสอบ](../backend/VERIFICATION.md)

การเพิ่มโค้ดนี้ไม่ได้เปลี่ยนหน้า Dashboard/VoiceReporter ให้เรียก Backend อัตโนมัติ ทีม Frontend ต้องนำ service ไปเชื่อมตามรายการข้างบน

## Deploy

Vercel AI project ตั้ง Root Directory=`ai-server` และตั้ง server env ทั้งหมดรวม shared secret ส่วน Frontend deploy เป็นอีก project ที่ root ตั้ง public env ให้เรียก Supabase Edge URL ที่ deploy แล้ว Backend deploy จาก `backend/` ด้วย Supabase CLI และตั้ง AI_SERVER_URL เป็น HTTPS จริง (ALLOW_LOCAL_AI=false)
