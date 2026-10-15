# CampusCare AI — Backend MVP

**เริ่มจาก [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md)** สำหรับการเชื่อมชุดล่าสุด: Backend local พอร์ต 8000 → AI พอร์ต 3001 → Supabase บนคลาวด์ มี shared secret และ duplicate detection แล้ว ต้องรัน migration 004 เพิ่มครั้งเดียวบนฐานข้อมูลที่เคยรัน setup.sql

ชุด Backend สำหรับทีม Hackathon: Supabase PostgreSQL + RLS + Google Auth + private Storage + Edge API + Ubot adapter + ElevenLabs STT/TTS พร้อมตัวอย่างเชื่อม Next.js

## เริ่มใช้งาน

เครื่องมือที่ต้องมี: Supabase CLI, Docker สำหรับฐานข้อมูล local, Deno สำหรับตรวจ TypeScript; ทีม Frontend ใช้ Node.js LTS

1. สร้าง Supabase project ของทีม แล้วบันทึก Project Ref, Project URL และ publishable key
2. เปิด terminal ในโฟลเดอร์นี้ แล้วรัน:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

หรือใช้ SQL Editor รันไฟล์ทั้งหมดใน `supabase/migrations` ตามลำดับชื่อ 001 → 002 → 003 เพียงครั้งเดียวใน project ใหม่ ห้ามรันซ้ำหรือใช้กับฐานข้อมูลเดิมโดยไม่ตรวจ migration

3. เพิ่มอีเมลเจ้าหน้าที่จริงจาก SQL Editor ก่อนให้เจ้าหน้าที่สมัคร:

```sql
insert into public.staff_allowlist(email) values ('REPLACE_WITH_REAL_STAFF@kmitl.ac.th');
-- ใช้อีเมลตัวพิมพ์เล็กจริงเท่านั้น ตัวอย่างข้างบนต้องแก้ก่อนรัน
```

4. เพิ่มสถานที่จริงลง `locations` จาก SQL Editor เพื่อให้ Frontend ใช้รายการสถานที่เดียวกัน การรวมซ้ำอัตโนมัติต้องมี location_id ตรงกัน จึงไม่ใส่ข้อมูลอาคารสมมติไว้ให้

## ตั้ง Google Sign-In

1. Google Cloud Console: สร้าง OAuth client แบบ Web application และตั้ง consent screen/scopes สำหรับข้อมูลโปรไฟล์และอีเมล หากเป็น External และอยู่ใน Testing ให้เพิ่มบัญชีทีมเป็น Test users
2. Authorized redirect URI ของ Google คือ `https://PROJECT_REF.supabase.co/auth/v1/callback` (ไม่ใช่ URL หน้า Next.js)
3. Supabase → Authentication → Providers → Google: ใส่ Client ID/Secret และเปิด Google เปิดให้ใช้งานเฉพาะ provider ที่ทีมต้องการ; ปิด email/password สำหรับ MVP นี้
4. Authentication → URL Configuration: ตั้ง Site URL ของ Next.js และเพิ่ม redirect URL แบบเจาะจง เช่น `http://localhost:3000/auth/callback` และ URL production ที่ใช้จริง
5. Authentication → Hooks → Before User Created: เลือก PostgreSQL function `public.before_user_created` เพื่อกันอีเมลนอกเกณฑ์ตั้งแต่สมัคร หากยังไม่เปิด hook ระบบ API/RLS ยังปฏิเสธสิทธิ์ข้อมูล
6. นักศึกษาใช้เลข 8 หลักตามด้วย `@kmitl.ac.th`; เจ้าหน้าที่ต้องอยู่ใน staff_allowlist และเป็น `@kmitl.ac.th` บัญชีต้องมี Google identity และยืนยันอีเมลแล้ว

การตั้ง `hd=kmitl.ac.th` ใน Frontend เป็นเพียงตัวช่วยเลือกบัญชี สิทธิ์จริงตรวจใน API และ RLS ทุกครั้ง การเพิ่มหรือถอนเจ้าหน้าที่ให้ทำจาก SQL Editor เท่านั้น ไม่ใช้ user metadata ที่ผู้ใช้แก้เองได้

## ตั้งบริการและ deploy

**อัปเดตสำหรับ Server AI ของทีม:** ตั้ง `AI_SERVER_URL` เป็น base URL ของ server (ไม่ใส่ `/api/analyze`) ระบบจะเชื่อม Gemini `/api/analyze` และเสียง `/api/tts` ตาม contract ของทีม ต้องตั้ง `AI_SERVER_API_KEY` ให้ตรงกันทั้งสองโปรเจกต์ ไม่ต้องตั้ง `UBOT_URL`/`UBOT_API_KEY` ในโหมดนี้ AI รับ candidates เพื่อตรวจปัญหาซ้ำแล้ว และ Backend ยังต้องใช้ ELEVENLABS_API_KEY สำหรับถอดเสียง

URL `http://localhost:3000` ใช้ได้เฉพาะทดสอบบนเครื่องเดียวกับ Server AI (`deno task ai:test --local`) ก่อน deploy Supabase ต้องให้เพื่อนส่ง URL HTTPS ที่เข้าถึงได้จริง การปรับนี้ไม่ต้องรัน setup.sql หรือ migrations ซ้ำ

คัดลอก `.env.example` เป็น `.env` แล้วกรอก:

- `ALLOWED_ORIGINS`: origins ของ Frontend คั่นด้วย comma ไม่ใส่ path ห้ามใช้ wildcard
- `UBOT_URL`, `UBOT_API_KEY`: HTTPS adapter ที่ทีม AI สร้างตาม [API contract](docs/API.md)
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`: บัญชีและเสียงที่รองรับภาษาไทย ทดสอบเสียง/โมเดลกับบัญชีจริงก่อนเดโม
- `ELEVENLABS_TTS_MODEL`: ค่าเริ่มต้น `eleven_v3`; transcription ใช้ `scribe_v1`

```powershell
supabase secrets set --env-file .env
supabase functions deploy campuscare
```

Hosted Edge Functions มี `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ให้แล้ว ไม่ใส่ service key ใน Frontend หรือส่งให้ Ubot `verify_jwt=false` ตั้งใจให้ handler ตรวจ bearer token ด้วย `auth.getUser()` เอง เพื่อรองรับ signing keys ใหม่ ไม่ใช่เปิด API สาธารณะ

ยังไม่ได้เชื่อมบัญชีหรือ deploy ให้ เพราะ workspace ไม่มี Supabase project credentials, Google OAuth configuration และ API keys การสร้างไฟล์ไม่ทำให้บริการภายนอกพร้อมใช้งานอัตโนมัติ

## ส่งต่อทีม Frontend

1. ติดตั้ง `@supabase/supabase-js` ใน Next.js project
2. ใส่เฉพาะ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใน `.env.local`
3. คัดลอก `frontend/campuscare.ts` ไปเป็น browser service และ `frontend/auth-callback-page.tsx` ไป `app/auth/callback/page.tsx` แก้ import ให้ตรง
4. เชื่อม signIn → report creation → upload → receipt → processReport; เพิ่มปุ่ม retry ของรายงาน pending/failed
5. แสดงสถานะข้อความพร้อมเสียง ผู้ใช้ต้องกดเพื่อเล่นเสียงตาม browser policy และมีทางเลือกพิมพ์ข้อความเสมอ
6. Tap & Speak ใช้ `MediaRecorder` บน HTTPS/localhost ส่ง File ที่ MIME รองรับ ไม่บังคับถ่ายรูป Backend จะถอดเสียงผ่าน ElevenLabs แล้วส่งข้อความให้ Ubot

ไฟล์ Frontend เป็นตัวอย่าง integration ไม่มี UI สำเร็จรูปหรือ server-side route guard; API/RLS เป็นผู้บังคับสิทธิ์ หน้า Dashboard ใช้ role จาก `/me` เพื่อเลือก UI เท่านั้น

## ทดสอบ

มีไฟล์ `.env` สำหรับกรอกค่าจริงในเครื่อง (ถูก gitignore) และคำสั่งตรวจ/ทดสอบเพิ่มแล้ว:

```powershell
# ถ้า Deno ไม่อยู่ใน PATH ให้ใช้ D:\Hackathon\.tools\deno\deno.exe แทน deno
deno task setup:check
deno task test
deno task check
# หลังกรอก UBOT_URL/UBOT_API_KEY: ส่งรายงานสมมติไป AI จริง ไม่มีการเขียนฐานข้อมูล
deno task ai:test
```

`setup:check` แสดงเฉพาะชื่อค่าที่พร้อมหรือยังขาด ไม่แสดง secret; `ai:test` ตรวจด้วย client ตัวเดียวกับ API จริง ต้องให้คนทำ AI ส่ง endpoint และรูปแบบข้อมูลมาก่อน หากต่างจาก contract ต้องปรับ adapter ก่อนทดสอบ คำสั่งนี้อาจใช้เครดิตของ AI provider

```powershell
deno test supabase/functions/campuscare/domain_test.ts
deno check supabase/functions/campuscare/index.ts
```

ทดสอบฐานข้อมูลด้วย Supabase local หรือ staging ก่อนใช้จริง โดยใช้ checklist ใน [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) ห้ามถือว่า unit tests ทดแทน OAuth/RLS/provider end-to-end ได้

## ขอบเขต MVP

- ประมวลผลแบบเรียก API แยกหลังบันทึก ไม่มี queue/cron; เจ้าหน้าที่กด retry ได้เมื่อ provider ล่ม
- Daily Briefing ใช้ข้อความภาษาไทยจากยอดรวมที่คำนวณจริง ยังไม่ใช้ LLM เรียบเรียง เพื่อลดเวลาและป้องกันยอดคลาดเคลื่อน
- AI category/severity ถูกตรวจ schema และเสนอ duplicate ได้ แต่ยังไม่มีหน้าจอเจ้าหน้าที่รวมปัญหาหรือแก้หมวดหมู่
- ตอบรับเสียงแยกจากการรับรายงาน หาก ElevenLabs ล่มให้แสดงข้อความยืนยันเดิม รายงานไม่สูญหาย
- จำกัดชนิด/ขนาดไฟล์ แต่ยังไม่มี content scanning, hard per-user spend quotas หรือ rate limiter ก่อนเปิดใช้วงกว้างควรเพิ่ม gateway limits และ retention policy โดยเฉพาะไฟล์เสียง หลังรัน migration 004 ฐานข้อมูลจะล็อก report ระหว่างตรวจจำนวนไฟล์ ป้องกันการอัปโหลดเกิน 5 ไฟล์พร้อมกันและการแนบไฟล์หลังเริ่มประมวลผล
- Privacy: ส่งเนื้อหารายงาน/เสียงให้ผู้ให้บริการภายนอกตาม flow ที่ใช้ ควรแจ้งผู้ใช้ก่อนเริ่มบันทึกเสียง ไม่เก็บ API keys ลง git

## เอกสารต้นทาง

- [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Edge Function auth](https://supabase.com/docs/guides/functions/auth-legacy-jwt)
- [ElevenLabs STT](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)
- [ElevenLabs TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
