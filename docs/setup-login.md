# คู่มือตั้งค่าระบบบัญชีผู้ใช้ C.A.L.L. (ฉบับรวม — ทำรอบเดียวจบ)

**เข้าสู่ระบบได้ 2 แบบ:** อีเมล + รหัสผ่าน (ใช้ได้ทุกประเทศ รวมจีน) และ Google
**ฐานข้อมูล:** บัญชีผู้ใช้ + ประกาศงาน + หมุด + การกดรับงาน เก็บใน Supabase (ทุกเครื่องเห็นข้อมูลเดียวกัน)
ใช้บริการ**ฟรีทั้งหมด** · ใช้เวลาประมาณ 40–50 นาที · ทำตามลำดับ **1 → 11** (ข้อ 12 ทำเมื่อ Claude แจ้ง)
ชื่อปุ่มในหน้าเว็บของ Google / Supabase อาจเปลี่ยนเล็กน้อยตามเวอร์ชัน ถ้าหาไม่เจอ ให้ค้นด้วยคำภาษาอังกฤษในวงเล็บ

> ⚠️ **อย่าส่งรหัสลับใด ๆ ในแชต** — กรอกเองในหน้าเว็บของแต่ละบริการ
> ค่าที่ "เปิดเผยได้" มีแค่ 2 ตัว: **Project URL** และ **anon / publishable key**
> **ห้าม**ใช้ `service_role` / `secret` key กับหน้าเว็บ หรือใส่ในตัวแปรที่ขึ้นต้นด้วย `VITE_` เด็ดขาด

### เตรียมก่อนเริ่ม
- **บัญชี Gmail สำหรับโปรเจกต์** (แนะนำให้สมัครใหม่ เช่น `call.prototype@gmail.com`) — ใช้ส่งอีเมล "ลืมรหัสผ่าน" ให้ผู้ใช้ ผู้ใช้จะเห็นอีเมลนี้เป็นผู้ส่ง จึงไม่ควรใช้อีเมลส่วนตัว
- เปิด **การยืนยันตัวตนแบบ 2 ขั้นตอน (2-Step Verification)** ให้ Gmail นั้น (ต้องเปิดก่อนถึงจะสร้าง App Password ในข้อ 6 ได้)

---

## 1. สร้างโปรเจกต์ Supabase
1. เข้า https://supabase.com → **Start your project** → สมัคร/เข้าสู่ระบบ
2. **New project**
   - Name: `call-prototype`
   - Database password: ตั้งรหัสยาว ๆ แล้วเก็บในตัวจัดการรหัสผ่าน (เว็บไม่ได้ใช้รหัสนี้)
   - Region: **Southeast Asia (Singapore)** ← ใกล้ไทยที่สุด และตรงกับหน้านโยบายความเป็นส่วนตัว
   - Plan: **Free**
3. รอประมาณ 1–2 นาทีจนโปรเจกต์พร้อม

## 2. สร้างตารางในฐานข้อมูล (รัน 2 ไฟล์ ตามลำดับ)
เมนูซ้าย **SQL Editor** → **New query** → วางไฟล์ → **Run** → ต้องขึ้น **Success** → ทำซ้ำกับไฟล์ถัดไป
1. [`supabase/migrations/0001_profiles.sql`](../supabase/migrations/0001_profiles.sql) — บัญชีผู้ใช้
2. [`supabase/migrations/0002_matching.sql`](../supabase/migrations/0002_matching.sql) — ประกาศงาน หมุด การกดรับงาน (+ ประกาศตัวอย่าง 2 รายการ)

(รันซ้ำได้ ไม่พัง · ถ้าเปิดลิงก์ไม่ได้ ดูที่ GitHub: โฟลเดอร์ `supabase/migrations` ใน branch `poc/jobboard` แล้วกดปุ่ม Copy มุมขวาบนของไฟล์)

## 3. จดค่า 2 ตัวจาก Supabase
**Project Settings → API** (หรือ **Data API** / **API Keys**)
- **Project URL** — หน้าตาแบบ `https://abcdefghijkl.supabase.co`
- **anon public** key (หรือ **Publishable key** ที่ขึ้นต้นด้วย `sb_publishable_`)

## 4. เปิดการเข้าสู่ระบบด้วยอีเมล
**Authentication → Sign In / Providers → Email**
- **Enable Email provider**: เปิด
- **Confirm email**: **ปิด** ← สมัครแล้วใช้ได้ทันที (กรรมการไม่ต้องรออีเมลยืนยัน)
- **Minimum password length**: `8` (ถ้ามีช่องนี้ อาจอยู่ใน Authentication → **Policies** / **Password requirements**)
- Save

## 5. บอก Supabase ว่าเว็บไหนกลับมาได้
**Authentication → URL Configuration**
- **Site URL**: `https://china-thailand-ai.vercel.app`
- **Redirect URLs** → Add URL ทีละบรรทัด:
  - `https://china-thailand-ai.vercel.app/**`
  - `https://*-boss-608c.vercel.app/**` ← ให้ลิงก์ Preview ทุกตัวใช้ได้
  - `http://localhost:5288/**` ← สำหรับทดสอบในเครื่อง

## 6. ตั้งค่าให้ส่งอีเมล "ลืมรหัสผ่าน" ผ่าน Gmail (ฟรี)
Supabase แบบฟรีส่งอีเมลได้แค่คนในทีมและไม่เกิน 2 ฉบับ/ชั่วโมง จึงต้องใช้ Gmail ของโปรเจกต์ส่งแทน
1. **สร้าง App Password ของ Gmail**: เข้า https://myaccount.google.com/apppasswords ด้วย Gmail ของโปรเจกต์ → ตั้งชื่อ `Supabase` → Create → จดรหัส 16 ตัวอักษร (แสดงครั้งเดียว)
2. **Supabase → Authentication → Emails → SMTP Settings** (หรือ Project Settings → Authentication → SMTP) → **Enable Custom SMTP**
   | ช่อง | ใส่ |
   | --- | --- |
   | Sender email | Gmail ของโปรเจกต์ |
   | Sender name | `C.A.L.L.` |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | Gmail ของโปรเจกต์ |
   | Password | App Password 16 ตัวจากขั้นที่ 1 (ไม่ใช่รหัส Gmail ปกติ) |
3. Save

## 7. ออกรหัส "ล็อกอินด้วย Google" ใน Google Cloud
1. เข้า https://console.cloud.google.com (ใช้บัญชีไหนก็ได้ แนะนำ Gmail ของโปรเจกต์) → เลือกโปรเจกต์มุมบนซ้าย → **New project** → ชื่อ `CALL Prototype` → Create
2. ค้นหา **Google Auth Platform** (หรือ APIs & Services → **OAuth consent screen**) → **Get started**
   - App name: `C.A.L.L.` · User support email: อีเมลของคุณ · Audience: **External** · Contact information: อีเมลของคุณ → Create
3. **Branding** (ถ้ามีให้กรอก)
   - Application home page: `https://china-thailand-ai.vercel.app`
   - Application privacy policy link: `https://china-thailand-ai.vercel.app/privacy`
   - **ไม่ต้องใส่โลโก้** (ใส่แล้ว Google จะขอตรวจหลายวัน)
4. **Data Access / Scopes**: ไม่ต้องเพิ่มอะไร
5. **Clients → Create client**
   - Application type: **Web application** · Name: `C.A.L.L. web`
   - **Authorized redirect URIs** → Add URI: `https://<ProjectURL ของคุณ>/auth/v1/callback`
     (ตัวอย่าง `https://abcdefghijkl.supabase.co/auth/v1/callback` — คัดลอกได้จากช่อง "Callback URL" ในข้อ 8)
   - Create → จด **Client ID** และ **Client secret**

## 8. เปิด Google ใน Supabase
**Authentication → Sign In / Providers → Google** → Enable → วาง **Client ID** และ **Client secret** จากข้อ 7 → **Save**

## 9. ใส่ค่าใน Vercel
**Vercel → โปรเจกต์ china-thailand-ai → Settings → Environment Variables** → เพิ่ม 2 ตัว (ติ๊ก **Production** และ **Preview**)
| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL จากข้อ 3 |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key จากข้อ 3 |

จากนั้น**บอก Claude** — ค่าจะมีผลกับการ deploy ครั้งถัดไป

## 10. ใส่ค่าใน GitHub (ระบบปลุก Supabase ทุกวัน)
**GitHub → repo china-thailand-ai → Settings → Secrets and variables → Actions → New repository secret**
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = anon / publishable key

เริ่มทำงานเองหลังงานขึ้นเว็บจริง — วันละ 2 รอบ กันไม่ให้โปรเจกต์ฟรีถูกหยุดเมื่อไม่มีคนใช้ 7 วัน

## 11. ตั้งตัวเองเป็นแอดมิน (หลัง Claude ส่ง Preview ใหม่)
1. เปิดลิงก์ Preview → **สมัครสมาชิก** ด้วยอีเมล (หรือเข้าสู่ระบบด้วย Google)
2. Supabase → **SQL Editor** → รัน (เปลี่ยนเป็นอีเมลที่ใช้สมัคร):
   ```sql
   update public.profiles set role = 'admin' where email = 'อีเมลของคุณ';
   ```
3. รีเฟรชหน้าเว็บ → เมนูบัญชีจะมี "ระบบหลังบ้าน"

## 12. อัปเดตฐานข้อมูลสำหรับบอร์ดประกาศ (ทำครั้งเดียว เมื่อ Claude แจ้ง)
ระบบบอร์ดประกาศ (ระดับ 1–5, จองคิว, ต่ออายุ, หมุดรายสัปดาห์) ต้องการตารางและกฎเพิ่ม
1. Supabase → **SQL Editor** → **New query** → วางไฟล์ [`supabase/migrations/0003_board.sql`](../supabase/migrations/0003_board.sql) ทั้งไฟล์ → **Run** → ต้องขึ้น **Success**
2. ไม่ต้องตั้งค่าอื่นเพิ่ม (ไม่มีรหัสลับใหม่) · รันซ้ำได้ ไม่พัง · ข้อมูลเดิม (บัญชี ประกาศ หมุด การกดรับ) ยังอยู่ครบ
3. ใช้ร่วมกับเว็บเวอร์ชันก่อนหน้าได้ — รันก่อนหรือหลังขึ้นเว็บจริงก็ได้

**ตัวนับ "มีกี่คนกำลังดูประกาศนี้"** ใช้ระบบ Realtime ของ Supabase (เปิดอยู่แล้วในแผนฟรี) — ถ้าตัวนับไม่ขึ้นเลยทั้งที่เปิด 2 เครื่องพร้อมกัน: Supabase → **Realtime** → **Settings** → ต้อง**ไม่ได้**เปิด "Private channels only"

## 13. อัปเดตฐานข้อมูลสำหรับเคสและการยืนยันนายจ้าง (ทำครั้งเดียว หลังข้อ 12)
ระบบเคส 9 ขั้น การยืนยันตัวตนบริษัท และการจำกัดระดับของประกาศที่ยังไม่ยืนยัน ต้องการตารางและกฎเพิ่ม
1. ต้องรันข้อ 12 (`0003_board.sql`) ให้ขึ้น **Success** ก่อน
2. Supabase → **SQL Editor** → **New query** → วางไฟล์ [`supabase/migrations/0004_cases.sql`](../supabase/migrations/0004_cases.sql) ทั้งไฟล์ → **Run** → ต้องขึ้น **Success**
3. ไม่มีรหัสลับใหม่ · รันซ้ำได้ · ข้อมูลเดิมยังอยู่ครบ · ประกาศของนายจ้างจริงที่มีอยู่จะกลายเป็น "ยังไม่ยืนยันตัวตน" (เผยแพร่ได้ถึงระดับ 2) จนกว่าจะยืนยัน
4. ลองใช้: บัญชีนายจ้าง → **โปรไฟล์** → กรอกเลขทะเบียนบริษัท (ทดสอบด้วยเลขตัวอย่างที่ถูกรูปแบบ ไม่ต้องใช้เลขบริษัทจริง) → บัญชีแอดมิน → **ระบบหลังบ้าน** → "คำขอยืนยันตัวตนบริษัท" → อนุมัติ → นายจ้างยืนยันผู้สมัคร → เคสส่งให้หน่วยงานอัตโนมัติ → แอดมินเปิดเคสแล้วกดทีละขั้น

---

## ✅ เช็กลิสต์ก่อนวันส่งงาน (14)
- [ ] **เปิดให้ทุกคนใช้ Google ได้**: Google Auth Platform → **Audience → Publish app** (ต้องเป็น *In production*) — ถ้ายังเป็น *Testing* กรรมการจะล็อกอินด้วย Google ไม่ได้ (แต่สมัครด้วยอีเมลได้ปกติ)
- [ ] ลองสมัครด้วยอีเมลใหม่ → ใช้ได้ทันที
- [ ] ลอง "ลืมรหัสผ่าน" → อีเมลจาก Gmail ของโปรเจกต์มาถึง (ดูในโฟลเดอร์สแปมด้วย) → ตั้งรหัสใหม่ได้
- [ ] ลองล็อกอินด้วย Google จากมือถืออีกเครื่อง
- [ ] นายจ้างโพสต์จากเครื่องหนึ่ง → ผู้หางานอีกเครื่องเห็นและกดรับได้ → นายจ้างเห็นว่ามีคนรับ
- [ ] ข้อ 10 ใส่ secret แล้ว และ GitHub → **Actions → Supabase keep-alive → Run workflow** ได้เครื่องหมายเขียว
- [ ] ตั้งบัญชีตัวเองเป็นแอดมินแล้ว (ข้อ 11)
- [ ] ช่วงกรรมการพิจารณา: คอยดูอีเมลจาก Supabase ถ้ามีเตือนว่าจะหยุดโปรเจกต์ ให้เข้า Dashboard แล้วกด **Resume** (ข้อมูลไม่หาย)

## ถ้าเจอปัญหา
| อาการ | แก้ |
| --- | --- |
| รัน SQL แล้ว error | ต้องรันไฟล์ 0001 ก่อน 0002 · คัดลอกให้ครบทั้งไฟล์ |
| Google ขึ้น `redirect_uri_mismatch` | Redirect URI ในข้อ 7 ต้องตรงกับ Callback URL ของ Supabase ทุกตัวอักษร |
| Google ขึ้น "Access blocked" / แอปอยู่ในโหมดทดสอบ | เพิ่มอีเมลใน Audience → Test users หรือ Publish app |
| อีเมลลืมรหัสผ่านไม่มา | ตรวจข้อ 6: ใช้ App Password (ไม่ใช่รหัส Gmail) · Port 587 · ดูโฟลเดอร์สแปม |
| กลับมาที่เว็บแล้วยังไม่ล็อกอิน | ตรวจ Redirect URLs ในข้อ 5 |
| ไม่มีปุ่ม "เข้าสู่ระบบ" | ยังไม่ได้ใส่ค่าในข้อ 9 หรือยังไม่ได้ deploy ใหม่หลังใส่ค่า |
| ขึ้น "ระบบเข้าสู่ระบบใช้งานไม่ได้ชั่วคราว" | โปรเจกต์ Supabase อาจถูกหยุด → Dashboard → Resume |
