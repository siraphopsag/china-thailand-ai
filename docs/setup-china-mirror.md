# คู่มือทำลิงก์สำรองสำหรับผู้ใช้ในจีน (Cloudflare Pages · ฟรี)

**ทำไมต้องมี:** โดเมน `*.vercel.app` ถูกบล็อกในจีนแผ่นดินใหญ่เป็นส่วนใหญ่ (GreatFire ซึ่งทดสอบจากในจีนให้ผลว่า "Mostly blocked" ณ ต.ค. 2569)
กรรมการที่กวางสีจึงอาจเปิด https://china-thailand-ai.vercel.app ไม่ได้ ส่วน `*.pages.dev` ของ Cloudflare ได้ผล "Mixed"
คือบางลิงก์เปิดได้ปกติ บางลิงก์สะดุดเป็นบางครั้ง ซึ่งยังดีกว่า

**ลิงก์สำรองคืออะไร:** สำเนาของเว็บเดียวกัน build จากกิ่ง `main` ทุกครั้งที่ขึ้นเว็บ แต่**ไม่ใส่ค่าระบบบัญชี** เว็บจึงเข้า "โหมดสาธิตในเบราว์เซอร์" เอง
- ใช้ได้ทุกขั้นตอน (เลือกบทบาท ปักหมุด ลงประกาศ บอร์ด เคส ปฏิทิน และปุ่ม "จำลองผู้สมัคร") โดยไม่ต้องมีบัญชี
- ไม่เรียก Supabase, Google หรือ AI จึงไม่มีอะไรที่ถูกบล็อกในจีนมาทำให้หน้าค้าง ข้อมูลอยู่ในเบราว์เซอร์ของผู้ใช้เท่านั้น
- ทุกหน้ามีแถบสีฟ้าบอกว่าเป็นเวอร์ชันสาธิตสำรอง และบอกว่าการเข้าสู่ระบบและ AI จริงอยู่ในเว็บหลัก

ใช้เวลาประมาณ 10 นาที · **ฟรี** · ไม่มีค่าลับใด ๆ ต้องกรอก

> ⚠️ **อย่าใส่** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` หรือ `VITE_GOOGLE_CLIENT_ID` ในลิงก์สำรอง
> ถ้าใส่ เว็บจะพยายามต่อระบบบัญชี ซึ่งอาจช้าหรือถูกบล็อกในจีน และข้อมูลของผู้ใช้ในจีนจะถูกส่งออกนอกประเทศ

---

## 1. สมัคร Cloudflare
1. เข้า https://dash.cloudflare.com/sign-up
2. สมัครด้วย **อีเมลของโปรเจกต์** (`c.a.l.l.project00@gmail.com`) แล้วยืนยันอีเมล
3. ถ้ามีหน้าถามว่าจะเพิ่มโดเมนไหม ให้ข้ามไป (Skip) เพราะไม่ต้องใช้โดเมนของตัวเอง

## 2. สร้างโปรเจกต์ Pages จาก GitHub
1. เมนูซ้าย **Compute (Workers) → Workers & Pages** → **Create** (หรือ **Create application**)
2. เลือกแท็บ **Pages** → **Import an existing Git repository** (หรือ **Connect to Git**)
   - ถ้าเห็นแต่ตัวเลือกของ Workers ให้มองหาลิงก์เล็ก ๆ "Looking to deploy Pages? Get started"
3. **Connect GitHub** → อนุญาตให้ Cloudflare เข้าถึง**เฉพาะ repo** `siraphopsag/china-thailand-ai` (Only select repositories)
4. เลือก repo นั้น → **Begin setup**

## 3. ตั้งค่าการ build
| ช่อง | ค่า |
| --- | --- |
| Project name | `call-demo` (ถ้าชื่อซ้ำ ใช้ `call-demo-th` หรือชื่ออื่น · ชื่อนี้จะเป็นลิงก์ `https://<ชื่อ>.pages.dev`) |
| Production branch | `main` |
| Framework preset | `Vite` (หรือ None) |
| Build command | `npm run build` |
| Build output directory | `dist` |

เปิด **Environment variables (advanced)** → **Add variable** เพิ่มตัวเดียว:
- `NODE_VERSION` = `22`

แล้วกด **Save and Deploy** รอประมาณ 2–3 นาทีจนขึ้น **Success**

## 4. ตรวจผล
1. เปิด `https://<ชื่อ>.pages.dev`
2. ต้องเห็น**แถบสีฟ้า** "เวอร์ชันสาธิตสำรอง…" ด้านบน
3. ลองเลือกบทบาทนายจ้าง → ลงประกาศ → เปิดประกาศ → กด "จำลองผู้สมัคร 1 คน" → ยืนยัน
4. ส่งลิงก์ให้ Claude ในแชตได้เลย (ลิงก์นี้เปิดเผยได้) เพื่อใส่ในเอกสารประกวด

หลังจากนี้ทุกครั้งที่ขึ้นเว็บจริง (`main`) ลิงก์สำรองจะ build ใหม่เองโดยอัตโนมัติ

## 5. ทดสอบจากจีน (แนะนำ)
- **ดีที่สุด:** ให้คนที่อยู่ในจีน (เช่น อาจารย์หรือเพื่อนที่กวางสี) เปิดทั้ง 2 ลิงก์จากเน็ตบ้านและเน็ตมือถือ
- **หรือ:** ใช้เว็บตรวจจากเซิร์ฟเวอร์ในจีน เช่น https://www.comparitech.com/privacy-security-tools/blockedinchina/ แล้วกรอกชื่อโดเมน
  (ผลตรวจเป็นแค่ภาพรวม เน็ตแต่ละค่ายในจีนอาจให้ผลต่างกัน)

## ถ้าหาเมนู Pages ไม่เจอ: ใช้ Netlify แทน (ฟรีเหมือนกัน)
1. https://app.netlify.com/signup → สมัครด้วย GitHub หรืออีเมลโปรเจกต์
2. **Add new site → Import an existing project → GitHub** → เลือก `siraphopsag/china-thailand-ai`
3. Branch `main` · Build command `npm run build` · Publish directory `dist` · เพิ่ม Environment variable `NODE_VERSION` = `22`
4. **Deploy** → ลิงก์จะเป็น `https://<ชื่อ>.netlify.app` (เปลี่ยนชื่อได้ที่ Site configuration → Change site name)

เว็บรู้จักทั้ง `*.pages.dev` และ `*.netlify.app` อยู่แล้ว จึงขึ้นแถบสีฟ้าให้เองทั้งสองแบบ ไฟล์ `public/_redirects` ช่วยให้เปิดหน้าใดก็ได้โดยตรงทั้งบน Cloudflare และ Netlify

## ทางเลือกที่เสียเงิน (ไม่แนะนำตอนนี้)
- **ซื้อโดเมนของตัวเอง** (ประมาณ 300–500 บาทต่อปี) แล้วผูกกับ Vercel: Vercel ระบุว่าโดเมนของตัวเองถูกบล็อกน้อยกว่า `vercel.app` แต่ไม่รับประกัน
- **โฮสต์ในจีน:** ต้องมีใบอนุญาต ICP ซึ่งทำไม่ทันและไม่จำเป็นสำหรับต้นแบบ
