// Draws the four overview diagrams. Run from the project root: node docs/diagrams/generate.cjs docs/diagrams
const fs = require('fs')
const out = process.argv[2]
const STYLE = `<style>
.t,.ts,.th{font-family:'Noto Sans Thai','Segoe UI','PingFang SC',sans-serif}
.t{font-size:14px;font-weight:400;fill:#2C2C2A}.ts{font-size:12px;font-weight:400;fill:#5F5E5A}.th{font-size:14px;font-weight:500;fill:#2C2C2A}
.box{fill:#F1EFE8;stroke:#888780}.arr{stroke:#888780;stroke-width:1.5;fill:none}.dash{fill:none;stroke:#888780}
.c-purple>rect,rect.c-purple{fill:#EEEDFE;stroke:#534AB7}.c-purple>.th{fill:#3C3489}.c-purple>.ts{fill:#534AB7}
.c-teal>rect,rect.c-teal{fill:#E1F5EE;stroke:#0F6E56}.c-teal>.th{fill:#085041}.c-teal>.ts{fill:#0F6E56}
@media (prefers-color-scheme:dark){.t,.th{fill:#F1EFE8}.ts{fill:#B4B2A9}.box{fill:#2C2C2A;stroke:#888780}
.c-purple>rect,rect.c-purple{fill:#3C3489;stroke:#AFA9EC}.c-purple>.th{fill:#CECBF6}.c-purple>.ts{fill:#AFA9EC}
.c-teal>rect,rect.c-teal{fill:#085041;stroke:#5DCAA5}.c-teal>.th{fill:#9FE1CB}.c-teal>.ts{fill:#5DCAA5}}
</style>`
const MARK = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#888780" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>'
const g = (cls, x, y, w, h, title, sub) => {
  const cx = x + w / 2
  const shape = cls === 'box' ? `<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="8" stroke-width="0.5"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" stroke-width="0.5"/>`
  const txt = sub !== undefined
    ? `<text class="th" x="${cx}" y="${y + 19}" text-anchor="middle" dominant-baseline="central">${title}</text><text class="ts" x="${cx}" y="${y + 38}" text-anchor="middle" dominant-baseline="central">${sub}</text>`
    : `<text class="th" x="${cx}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central">${title}</text>`
  return cls === 'box' ? `<g>${shape}${txt}</g>` : `<g class="${cls}">${shape}${txt}</g>`
}
const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="arr" marker-end="url(#arrow)"/>`
const legend = (y, items) => items.map(([cls, x, label]) => `<rect class="${cls}" x="${x}" y="${y - 7}" width="14" height="14" rx="3" stroke-width="0.5"/><text class="ts" x="${x + 22}" y="${y}" dominant-baseline="central">${label}</text>`).join('')
const svg = (h, title, desc, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="${h}" viewBox="0 0 680 ${h}" role="img"><title>${title}</title><desc>${desc}</desc>${STYLE}${MARK}${body}</svg>\n`

const d1 = svg(420, 'โครงสร้างระบบ C.A.L.L. ตอนนี้ (ต้นแบบ)', 'เบราว์เซอร์ของผู้ใช้มีหน้านายจ้าง ผู้หางาน หลังบ้าน ตัวตรวจเบื้องต้น ข้อมูลในเครื่อง และคลังกฎหมาย เชื่อมกับ Vercel, GitHub Actions และเว็บไซต์ราชการ (ยังไม่มีเซิร์ฟเวอร์ API)', [
  '<g class="c-purple"><rect x="40" y="30" width="400" height="270" rx="20" stroke-width="0.5"/><text class="th" x="60" y="56" dominant-baseline="central">เบราว์เซอร์ของผู้ใช้ (เว็บแอป React)</text></g>',
  g('box', 60, 80, 110, 56, 'นายจ้าง', 'โพสต์งาน'), g('box', 185, 80, 110, 56, 'ผู้หางาน', 'ปักหมุด · รับงาน'), g('box', 310, 80, 110, 56, 'หลังบ้าน', 'แอดมินดูเคส'),
  g('box', 60, 156, 170, 56, 'ตรวจเบื้องต้น', 'กฎง่าย ๆ (จำลอง AI)'), g('box', 250, 156, 170, 56, 'ข้อมูลในเครื่อง', 'เก็บในเบราว์เซอร์'),
  g('box', 60, 232, 360, 44, 'คลังกฎหมาย + ระดับความน่าเชื่อถือ'),
  g('c-teal', 480, 40, 160, 56, 'Vercel', 'โฮสต์หน้าเว็บ'),
  g('c-teal', 480, 220, 160, 56, 'GitHub Actions', 'เฝ้ากฎหมายทุกวัน'), g('c-teal', 480, 310, 160, 56, 'เว็บไซต์ราชการ', 'ตัวบทกฎหมายต้นทาง'),
  line(478, 68, 444, 68), line(478, 248, 444, 248), line(560, 310, 560, 280),
  legend(395, [['c-purple', 40, 'ทำงานในเครื่องผู้ใช้'], ['c-teal', 230, 'บริการภายนอก']]),
].join(''))

const rowsY = [40, 120, 200, 280, 360]
const left = [['นายจ้างกรอกโพสต์', 'ข้อมูลงาน 4 กลุ่ม'], ['ตรวจเบื้องต้น (จำลอง AI)', 'มีข้อผิด → กลับไปแก้'], ['ยืนยันโพสต์', 'ถามก่อนโพสต์จริง'], ['เช็กโควตา 7 วัน', 'เกิน 3 → แพ็กสมาชิก (10)'], ['โพสต์แล้ว', 'ดูสถานะได้ที่หน้าโพสต์']]
const right = [['ขั้น 1 · วันแรก', 'จังหวัดเดียวกัน + ตรงสาย'], ['ขั้น 2 · หลัง 1 วัน', 'จังหวัดเดียวกันทุกสาย'], ['ขั้น 3 · หลัง 2 วัน', 'ทั้งประเทศ (ที่ปักหมุดไว้)'], ['ผู้หางานกดรับ', 'มีคนรับ → หยุดขยายวง'], ['ส่งต่อหน่วยงานจัดหางาน', 'ตอนนี้เป็นการจำลอง']]
const d2 = svg(470, 'ขั้นตอนการจับคู่งานตอนนี้', 'นายจ้างกรอกโพสต์ ตรวจเบื้องต้น ยืนยัน เช็กโควตา แล้วโพสต์ ระบบแจ้งผู้หางานเป็นสามขั้นตามวัน ผู้หางานกดรับ แล้วส่งต่อหน่วยงานจัดหางานแบบจำลอง', [
  ...left.map(([a, b], i) => g('c-purple', 40, rowsY[i], 260, 56, a, b)), ...right.map(([a, b], i) => g('c-teal', 380, rowsY[i], 260, 56, a, b)),
  ...[0, 1, 2, 3].flatMap((i) => [line(170, rowsY[i] + 56, 170, rowsY[i + 1] - 2), line(510, rowsY[i] + 56, 510, rowsY[i + 1] - 2)]),
  '<path d="M302 388 L340 388 L340 68 L376 68" class="arr" marker-end="url(#arrow)"/>',
  legend(447, [['c-purple', 40, 'ฝั่งนายจ้าง'], ['c-teal', 200, 'ฝั่งผู้หางาน / ระบบแจ้งเตือน']]),
].join(''))

const d3 = svg(560, 'โครงสร้างระบบ C.A.L.L. ที่เสนอสำหรับอนาคต', 'ผู้ใช้สามกลุ่มเข้าเว็บแอป เว็บแอปคุยกับเซิร์ฟเวอร์ API ตัวกลาง ซึ่งเชื่อมบริการภายนอกหกอย่าง ได้แก่ บัญชีผู้ใช้ ฐานข้อมูลกลาง AI จริง แจ้งเตือน ชำระเงิน และหน่วยงานจัดหางาน', [
  g('box', 40, 40, 180, 44, 'นายจ้าง'), g('box', 250, 40, 180, 44, 'ผู้หางาน'), g('box', 460, 40, 180, 44, 'แอดมิน / หน่วยงานรัฐ'),
  line(130, 84, 130, 122), line(340, 84, 340, 122), line(550, 84, 550, 122),
  g('c-purple', 40, 124, 600, 56, 'เว็บแอป C.A.L.L. (มีอยู่แล้ว)', 'หน้าจอ 3 ภาษา · แผนที่ · ฟอร์ม'), line(340, 180, 340, 218),
  g('c-purple', 40, 220, 600, 56, 'เซิร์ฟเวอร์ API ตัวกลาง (ต้องสร้างเพิ่ม)', 'ตรวจสิทธิ์ · กันสแปม · เก็บคีย์ลับ · บันทึกการใช้งาน'), line(340, 276, 340, 314),
  '<rect class="dash" x="40" y="316" width="600" height="192" rx="12" stroke-dasharray="4 4" stroke-width="0.5"/><text class="ts" x="60" y="336" dominant-baseline="central">บริการที่จะเชื่อมในอนาคต</text>',
  g('c-teal', 60, 352, 170, 56, 'บัญชีผู้ใช้', 'ล็อกอินจริง'), g('c-teal', 250, 352, 170, 56, 'ฐานข้อมูลกลาง', 'ข้อมูลตรงกันทุกเครื่อง'), g('c-teal', 440, 352, 170, 56, 'AI จริง (LLM)', 'ตรวจโพสต์ · ตอบกฎหมาย'),
  g('c-teal', 60, 428, 170, 56, 'แจ้งเตือน', 'LINE · SMS · อีเมล'), g('c-teal', 250, 428, 170, 56, 'ชำระเงิน', 'แพ็กสมาชิก'), g('c-teal', 440, 428, 170, 56, 'หน่วยงานจัดหางาน', 'ส่งต่อเคสจริง'),
  legend(535, [['c-purple', 40, 'ระบบของเรา'], ['c-teal', 200, 'บริการภายนอก (อนาคต)']]),
].join(''))

const phases = [['box', 'ตอนนี้ · ต้นแบบบน Preview', 'ข้อมูลจำลอง · ทุกอย่างอยู่ในเบราว์เซอร์'], ['c-purple', 'เฟส 1 · รากฐาน', 'บัญชีผู้ใช้ · ฐานข้อมูลกลาง · เซิร์ฟเวอร์ API'], ['c-purple', 'เฟส 2 · เชื่อม AI และแจ้งเตือน', 'AI ตรวจโพสต์และตอบกฎหมาย · LINE / SMS'], ['c-purple', 'เฟส 3 · เปิดใช้จริง', 'ชำระเงิน · ส่งต่อหน่วยงาน · PDPA'], ['c-purple', 'เฟส 4 · ขยายอาเซียน', 'เปิดประเทศที่ขึ้นว่า เร็ว ๆ นี้']]
const d4 = svg(460, 'แผนการเชื่อมต่อในอนาคตทีละเฟส', 'จากต้นแบบตอนนี้ ไปเฟส 1 รากฐาน เฟส 2 เชื่อม AI และแจ้งเตือน เฟส 3 เปิดใช้จริง และเฟส 4 ขยายอาเซียน', [
  ...phases.map(([c, a, b], i) => g(c, 130, 40 + i * 84, 420, 56, a, b)), ...[0, 1, 2, 3].map((i) => line(340, 96 + i * 84, 340, 122 + i * 84)),
].join(''))

for (const [n, s] of [['01-system-now.svg', d1], ['02-matching-flow.svg', d2], ['03-future-architecture.svg', d3], ['04-integration-roadmap.svg', d4]]) fs.writeFileSync(`${out}/${n}`, s)
console.log('ok')
