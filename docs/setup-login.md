# คู่มือตั้งค่า "เข้าสู่ระบบด้วย Google" (Supabase + Google Cloud + Vercel)

ใช้เวลาประมาณ 20–30 นาที ทุกบริการใช้แบบ**ฟรี** — ทำตามลำดับ 1 → 9
ชื่อปุ่มในหน้าเว็บของ Google / Supabase อาจเปลี่ยนเล็กน้อยตามเวอร์ชัน ถ้าหาไม่เจอ ให้ค้นด้วยคำภาษาอังกฤษในวงเล็บ

> ⚠️ **อย่าส่งรหัสลับในแชต** — ค่าที่ต้องกรอกทั้งหมด คุณกรอกเองในหน้าเว็บของแต่ละบริการ
> ค่าที่ "เปิดเผยได้" มีแค่ 2 ตัว: **Project URL** และ **anon / publishable key** (หน้าเว็บใช้ได้ เพราะสิทธิ์อ่านข้อมูลถูกคุมในฐานข้อมูล)
> **ห้าม**ใช้ `service_role` / `secret` key กับหน้าเว็บหรือใส่ในตัวแปรที่ขึ้นต้นด้วย `VITE_` เด็ดขาด

---

## 1. สร้างโปรเจกต์ Supabase
1. เข้า https://supabase.com → **Start your project** → สมัคร/เข้าสู่ระบบ
2. **New project**
   - Name: `call-prototype`
   - Database password: ตั้งรหัสยาว ๆ แล้วเก็บในตัวจัดการรหัสผ่าน (เว็บไม่ได้ใช้รหัสนี้)
   - Region: **Southeast Asia (Singapore)** ← ใกล้ไทยที่สุด และตรงกับที่เขียนในหน้านโยบายความเป็นส่วนตัว
   - Plan: **Free**
3. รอประมาณ 1–2 นาทีจนโปรเจกต์พร้อม

## 2. สร้างตารางผู้ใช้ (รันครั้งเดียว)
1. เมนูซ้าย **SQL Editor** → **New query**
2. เปิดไฟล์ [`supabase/migrations/0001_profiles.sql`](../supabase/migrations/0001_profiles.sql) ในโปรเจกต์ → คัดลอกทั้งหมด → วาง → **Run**
3. ต้องขึ้น **Success** (รันซ้ำได้ ไม่พัง)

## 3. จดค่า 2 ตัวจาก Supabase
**Project Settings → API** (หรือ **Data API** / **API Keys**)
- **Project URL** — หน้าตาแบบ `https://abcdefghijkl.supabase.co`
- **anon public** key (หรือ **Publishable key** ที่ขึ้นต้นด้วย `sb_publishable_`)

## 4. ออกรหัส "ล็อกอินด้วย Google" ใน Google Cloud
1. เข้า https://console.cloud.google.com → มุมบนซ้าย เลือกโปรเจกต์ → **New project** → ตั้งชื่อ `CALL Prototype` → Create
2. ค้นหา **Google Auth Platform** (หรือ APIs & Services → **OAuth consent screen**) → **Get started**
   - App name: `C.A.L.L.`
   - User support email: อีเมลของคุณ
   - Audience: **External**
   - Contact information: อีเมลของคุณ → Create
3. **Branding** (ถ้ามีให้กรอก)
   - Application home page: `https://china-thailand-ai.vercel.app`
   - Application privacy policy link: `https://china-thailand-ai.vercel.app/privacy`
   - **ไม่ต้องใส่โลโก้** (ใส่โลโก้แล้ว Google จะขอตรวจสอบ ใช้เวลาหลายวัน)
4. **Data Access / Scopes**: ไม่ต้องเพิ่มอะไร (ใช้แค่ชื่อ อีเมล รูปโปรไฟล์ ซึ่งเป็นค่าพื้นฐาน)
5. **Clients → Create client**
   - Application type: **Web application**, Name: `C.A.L.L. web`
   - **Authorized redirect URIs** → Add URI: `https://<ProjectURL ของคุณ>/auth/v1/callback`
     (ตัวอย่าง `https://abcdefghijkl.supabase.co/auth/v1/callback` — คัดลอกจากหน้า Supabase ในข้อ 5 ช่อง "Callback URL" ได้)
   - Create → จด **Client ID** และ **Client secret** (เก็บ secret ไว้กับตัว ห้ามเผยแพร่)

## 5. เปิด Google ใน Supabase
**Authentication → Sign In / Providers → Google** → เปิด (Enable)
→ วาง **Client ID** และ **Client secret** จากข้อ 4 → **Save**

## 6. บอก Supabase ว่าเว็บไหนกลับมาได้
**Authentication → URL Configuration**
- **Site URL**: `https://china-thailand-ai.vercel.app`
- **Redirect URLs** → Add URL ทีละบรรทัด:
  - `https://china-thailand-ai.vercel.app/**`
  - `https://*-boss-608c.vercel.app/**` ← ให้ลิงก์ Preview ทุกตัวล็อกอินได้
  - `http://localhost:5288/**` ← สำหรับทดสอบในเครื่อง

## 7. ใส่ค่าใน Vercel
**Vercel → โปรเจกต์ china-thailand-ai → Settings → Environment Variables** → เพิ่ม 2 ตัว (ติ๊ก **Production** และ **Preview**)
| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL จากข้อ 3 |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key จากข้อ 3 |

จากนั้นบอก Claude ให้ส่ง Preview ใหม่ (หรือ Deployments → ตัวล่าสุด → **Redeploy**) — ค่าจะมีผลกับการ deploy ครั้งถัดไปเท่านั้น

## 8. ใส่ค่าใน GitHub (ระบบปลุก Supabase ทุกวัน)
**GitHub → repo china-thailand-ai → Settings → Secrets and variables → Actions → New repository secret**
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = anon / publishable key

ระบบปลุกจะเริ่มทำงานเองหลังงานนี้ขึ้นเว็บจริง (`main`) — วันละ 2 รอบ กันไม่ให้โปรเจกต์ฟรีถูกหยุดเมื่อไม่มีคนใช้ 7 วัน
ลองกดเองได้ที่ GitHub → **Actions → Supabase keep-alive → Run workflow** (ต้องขึ้นเครื่องหมายถูกสีเขียว)

## 9. ลองล็อกอิน + ตั้งตัวเองเป็นแอดมิน
1. เปิดลิงก์ Preview → กด **เข้าสู่ระบบ** → **เข้าสู่ระบบด้วย Google** → เลือกบัญชี → กลับมาที่เว็บ จะเห็นรูป/ตัวอักษรแรกของชื่อที่มุมขวาบน
2. Supabase → **SQL Editor** → รัน (เปลี่ยนเป็นอีเมลของคุณ):
   ```sql
   update public.profiles set role = 'admin' where email = 'อีเมลของคุณ@gmail.com';
   ```
3. รีเฟรชหน้าเว็บ → เมนูบัญชีจะมี "ระบบหลังบ้าน" และเมนูข้างจะมีไอคอนโล่

---

## ✅ เช็กลิสต์ก่อนวันส่งงาน (14)
- [ ] **เปิดให้ทุกคนล็อกอินได้**: Google Auth Platform → **Audience → Publish app** (สถานะต้องเป็น *In production*)
  ถ้ายังเป็น *Testing* จะล็อกอินได้เฉพาะอีเมลที่เพิ่มไว้ใน Test users เท่านั้น — กรรมการจะเข้าไม่ได้
  (เราใช้แค่ชื่อ อีเมล รูป จึงไม่ควรต้องรอ Google ตรวจ ถ้า Google แจ้งให้ยืนยันอะไร บอก Claude)
- [ ] ข้อ 8 ใส่ secret ใน GitHub แล้ว และกด Run workflow ได้เครื่องหมายเขียว
- [ ] ตั้งบัญชีตัวเองเป็นแอดมินแล้ว (ข้อ 9)
- [ ] ลองล็อกอินจากมือถืออีกเครื่อง (บัญชี Google อื่น) ได้
- [ ] ช่วงกรรมการพิจารณา: คอยดูอีเมลจาก Supabase ถ้ามีเตือนว่าจะหยุดโปรเจกต์ ให้เข้า Dashboard แล้วกด **Resume** / เปิดโปรเจกต์ (ข้อมูลไม่หาย)

## ถ้าเจอปัญหา
| อาการ | แก้ |
| --- | --- |
| Google ขึ้น `redirect_uri_mismatch` | Redirect URI ในข้อ 4 ต้องตรงกับ Callback URL ของ Supabase ทุกตัวอักษร |
| Google ขึ้น "Access blocked … has not completed the Google verification process" / แอปอยู่ในโหมดทดสอบ | เพิ่มอีเมลใน Audience → Test users หรือ Publish app (เช็กลิสต์ข้อแรก) |
| กลับมาที่เว็บแล้วยังไม่ล็อกอิน | ตรวจ Redirect URLs ในข้อ 6 (ต้องมีลิงก์ที่เปิดอยู่) |
| ไม่มีปุ่ม "เข้าสู่ระบบ" | ยังไม่ได้ใส่ค่าในข้อ 7 หรือยังไม่ได้ deploy ใหม่หลังใส่ค่า |
| ขึ้น "ระบบเข้าสู่ระบบใช้งานไม่ได้ชั่วคราว" | โปรเจกต์ Supabase อาจถูกหยุด → Dashboard → Resume; ส่วนอื่นของเว็บยังใช้ได้ |
