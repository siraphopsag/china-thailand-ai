// Steps 2–4 of the middle system (v2 model, owner Nov 2026): the passport against the record, the partner law firm's review and
// signing on screen or on paper. The contract page (contract.tsx) holds the state; these parts only show it and report changes.
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as RPointerEvent } from 'react'
import { tr, type Lang } from '../i18n/core'
import { useI18n } from '../i18n'
import { identityCheck, makeMrz, parseMrz, type IdFinding, type IdRecord, type MrzProblem } from '../domain/match/mrz'
import { addSignature, shortHash, signBlock, signStatus, type Review, type ReviewNote, type Side, type SignState } from '../domain/match/sign'
import type { Country } from '../domain/match/types'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { useNames } from './match'

const NATIONALITIES = ['THA', 'CHN'] as const

/** the training sample (an invented worker with the usual Thai placeholder name, not a real person) */
export const SAMPLE_RECORD: IdRecord = { surname: 'LI', given: 'MING', birth: '1996-05-20', nationality: 'CHN' }
export const SAMPLE_MRZ = makeMrz({ surname: 'LI', given: 'MING', number: 'E12345678', nationality: 'CHN', birth: '1996-05-20', expiry: '2031-08-30', sex: 'M' })
/** the problem sample: another first name, born 2009, the passport runs out in 3 months and one digit of its number was changed */
export function badSampleMrz(today: string): string {
  const d = new Date(today + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 3)
  const [l1, l2] = makeMrz({ surname: 'LI', given: 'MIN', number: 'E12345678', nationality: 'CHN', birth: '2009-05-20', expiry: d.toISOString().slice(0, 10), sex: 'M' }).split('\n')
  return `${l1}\n${l2.slice(0, 4)}8${l2.slice(5)}`
}

/* ============ step 2: identity ============ */
export function IdentityStep({ record, mrz, country, today, checked, onRecord, onMrz, onCheck, sample, onSample }: {
  record: IdRecord; mrz: string; country: Country; today: string; checked: boolean
  onRecord: (r: IdRecord) => void; onMrz: (s: string) => void; onCheck: () => void
  sample: boolean; onSample: (bad: boolean) => void
}) {
  const { t } = useI18n()
  const parsed = mrz.trim() ? parseMrz(mrz, today) : null
  const findings = checked && parsed?.ok ? identityCheck(parsed.value, record, country, today) : null
  const set = (p: Partial<IdRecord>) => onRecord({ ...record, ...p })
  return (
    <div className="space-y-4">
      <section className="card space-y-3" aria-labelledby="id-rec">
        <h3 id="id-rec" className="h2">{t('id.rec.h')}</h3>
        <p className="text-xs text-muted">{t('id.rec.d')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <label className="space-y-1"><span className="font-medium">{t('id.f.surname')}</span><input className="input w-full uppercase" value={record.surname} onChange={(e) => set({ surname: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-medium">{t('id.f.given')}</span><input className="input w-full uppercase" value={record.given} onChange={(e) => set({ given: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-medium">{t('id.f.birth')}</span><input className="input w-full" type="date" value={record.birth} onChange={(e) => set({ birth: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-medium">{t('id.f.nat')}</span>
            <select className="input w-full" value={record.nationality} onChange={(e) => set({ nationality: e.target.value })}>{NATIONALITIES.map((n) => <option key={n} value={n}>{t(`id.nat.${n}` as never)}</option>)}</select></label>
        </div>
      </section>
      <section className="card space-y-3" aria-labelledby="id-mrz">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="id-mrz" className="h2">{t('id.mrz.h')}</h3>
          {sample && <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={() => onSample(false)}>{t('id.sample.good')}</button>
            <button type="button" className="btn-soft text-sm" onClick={() => onSample(true)}>{t('id.sample.bad')}</button></div>}</div>
        <p className="text-xs text-muted">{t('id.mrz.d')}</p>
        <MrzPicture />
        <label className="block space-y-1 text-sm"><span className="font-medium">{t('id.mrz.label')}</span>
          <textarea className="input w-full font-mono text-xs sm:text-sm leading-relaxed min-h-[84px] uppercase tracking-wider" spellCheck={false} value={mrz} onChange={(e) => onMrz(e.target.value)} placeholder={'P<THA…\n…'} /></label>
        {parsed && !parsed.ok && <p className="text-sm text-danger-fg" role="alert">{t(`id.err.${parsed.problem satisfies MrzProblem}` as never)}</p>}
        {parsed?.ok && <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-line p-3">
          <dt className="text-muted">{t('id.read.name')}</dt><dd className="font-mono">{parsed.value.surname} {parsed.value.given}</dd>
          <dt className="text-muted">{t('id.read.no')}</dt><dd className="font-mono">{parsed.value.number}</dd>
          <dt className="text-muted">{t('id.read.birth')}</dt><dd className="font-mono">{parsed.value.birth}</dd>
          <dt className="text-muted">{t('id.read.nat')}</dt><dd className="font-mono">{parsed.value.nationality}</dd>
          <dt className="text-muted">{t('id.read.expiry')}</dt><dd className="font-mono">{parsed.value.expiry}</dd>
        </dl>}
        <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!parsed?.ok} onClick={onCheck}><Icon name="personCheck" size={16} />{t('id.check')}</button></div>
        {findings && <IdFindings list={findings} />}
        <p className="text-xs text-muted">{t('id.privacy')}</p>
      </section>
    </div>
  )
}
/** where the two lines are on the photo page (a drawing, no real passport) */
function MrzPicture() {
  return (
    <svg viewBox="0 0 320 120" className="w-full max-w-sm rounded-xl border border-line bg-surface" aria-hidden>
      <rect x="14" y="14" width="56" height="66" rx="6" className="fill-surface3" />
      {[18, 32, 46, 60].map((y) => <rect key={y} x="84" y={y} width={y === 18 ? 150 : 200} height="7" rx="3.5" className="fill-surface3" />)}
      <rect x="8" y="84" width="304" height="30" rx="6" className="fill-primary/10 stroke-primary" strokeWidth="1.5" strokeDasharray="4 3" />
      {SAMPLE_MRZ.split('\n').map((l, i) => <text key={i} x="14" y={98 + i * 11} className="fill-ink" fontSize="8.2" fontFamily="monospace" textLength="292">{l}</text>)}
    </svg>
  )
}
function IdFindings({ list }: { list: IdFinding[] }) {
  const { t } = useI18n()
  if (!list.length) return <p className="text-sm text-ok-fg font-medium flex items-center gap-1.5" role="status"><Icon name="verified" size={16} />{t('id.ok')}</p>
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm font-semibold text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={16} />{t('id.found', { n: list.length })}</p>
      <ul className="space-y-2">{list.map((f) => (
        <li key={f.flag} className={`rounded-lg border p-3 text-sm space-y-1 ${f.severity === 'high' ? 'border-danger-line bg-danger-bg text-danger-fg' : 'border-warn-line bg-warn-bg text-warn-fg'}`}>
          <p className="font-medium">{t(`id.flag.${f.flag}` as never, (f.vars ?? {}) as never)}</p>
          {f.laws.length > 0 && <p className="flex flex-wrap gap-1.5">{f.laws.map((l) => <span key={l} className="chip bg-surface3 text-ink border-line text-xs">{t(l as never)}</span>)}</p>}
        </li>))}</ul>
    </div>
  )
}
export const idHigh = (f: IdFinding[] | null) => (f ? f.filter((x) => x.severity === 'high').length : 0)

/* ============ step 3: partner law firm ============ */
export function ReviewStep({ country, review, canSend, onSend, onAdvance }: {
  country: Country; review: Review | null; canSend: boolean; onSend: () => void; onAdvance: () => void
}) {
  const { t } = useI18n()
  const N = useNames()
  const steps = ['sent', 'reviewing', 'done'] as const
  const at = review ? steps.indexOf(review.status) : -1
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
      <section className="card space-y-3" aria-labelledby="rv-h">
        <h3 id="rv-h" className="h2 flex items-center gap-2"><Icon name="legal" size={18} className="text-primary" />{t('rv.h')}</h3>
        <p className="text-sm text-muted">{t('rv.d')}</p>
        <div className="rounded-xl border border-line p-3 flex items-start gap-3">
          <span className="glass-drop w-10 h-10 shrink-0"><Icon name="business" size={18} /></span>
          <div className="min-w-0"><p className="font-semibold">{t(`rv.firm.${country}` as never)}</p><p className="text-xs text-muted">{t(`rv.firm.${country}.d` as never)}</p></div>
        </div>
        <ol className="grid grid-cols-3 gap-2" aria-label={t('rv.status')}>{steps.map((s, i) => (
          <li key={s} className={`rounded-xl border px-2 py-2 text-center text-xs sm:text-sm ${i <= at ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-line text-muted'}`}>
            <span className="block text-[11px] opacity-80">{i + 1}</span>{t(`rv.st.${s}` as never)}</li>))}</ol>
        {!review && (canSend
          ? <button type="button" className="btn-primary" onClick={onSend}><Icon name="send" size={16} />{t('rv.send')}</button>
          : <Warn>{t('rv.needCheck')}</Warn>)}
        {review && <p className="text-xs text-muted">{t('rv.sentAt', { d: N.dayTime(Date.parse(review.sentAt)) })}</p>}
        {review?.status === 'done' && <ReviewReply notes={review.notes} />}
        <p className="text-xs text-muted">{t('rv.optional')}</p>
      </section>
      {review && review.status !== 'done' && (
        <section className="card space-y-2 border-dashed" aria-labelledby="rv-demo">
          <h3 id="rv-demo" className="font-semibold text-sm flex items-center gap-2"><Icon name="sim" size={16} />{t('rv.demo.h')}</h3>
          <p className="text-xs text-muted">{t('rv.demo.d')}</p>
          <button type="button" className="btn-soft" onClick={onAdvance}>{t(review.status === 'sent' ? 'rv.demo.take' : 'rv.demo.reply')}</button>
        </section>)}
    </div>
  )
}
function ReviewReply({ notes }: { notes: ReviewNote[] }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-line p-3 space-y-2" role="status">
      <p className="font-semibold text-sm">{t('rv.reply')}</p>
      <ul className="space-y-1.5 text-sm">{notes.map((n, i) => (
        <li key={i} className={`flex items-start gap-2 ${n.kind === 'ok' ? 'text-ok-fg' : 'text-warn-fg'}`}><Icon name={n.kind === 'ok' ? 'ok' : 'edit'} size={15} className="mt-0.5 shrink-0" />{n.text}</li>))}</ul>
    </div>
  )
}

/* ============ step 4: signing ============ */
export function SignStep({ sign, hash, block, sides, docs, companyName, workerName, onSign, onMode, onPaper }: {
  sign: SignState | null; hash: string; block: ReturnType<typeof signBlock>; sides: Side[]
  docs: Record<'th' | 'zh', string[]>; companyName: string; workerName: string
  onSign: (side: Side, name: string, img: string) => void; onMode: (m: 'online' | 'paper') => void; onPaper: (f: File) => void
}) {
  const { t } = useI18n()
  const N = useNames()
  const status = signStatus(sign, hash)
  const mode = sign?.mode ?? 'online'
  const [side, setSide] = useState<Side>(sides[0] ?? 'worker')
  const printIt = () => printContract(docs, hash, companyName, workerName, sign)
  return (
    <div className="space-y-4">
      {block && <Warn tone="danger">{t(`sg.block.${block}` as never)}</Warn>}
      {status === 'changed' && <Warn tone="danger">{t('sg.changed')}</Warn>}
      <div className="grid 2xl:grid-cols-2 gap-4 items-start">
        <section className="card space-y-3" aria-labelledby="sg-doc">
          <h3 id="sg-doc" className="h2">{t('sg.doc.h')}</h3>
          <p className="text-xs text-muted flex items-center gap-1.5"><Icon name="lock" size={13} />{t('sg.hash')} <code className="font-mono text-ink">{shortHash(hash)}</code></p>
          <div className="grid sm:grid-cols-2 gap-3 text-xs max-h-72 overflow-y-auto pr-1">
            {(['th', 'zh'] as const).map((lg) => <ol key={lg} lang={lg === 'zh' ? 'zh-CN' : 'th'} className="space-y-1.5 list-decimal pl-4">{docs[lg].map((x, i) => <li key={i}>{x}</li>)}</ol>)}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(['worker', 'employer'] as const).map((s) => { const g = sign && sign.hash === hash ? sign[s] : undefined; return (
              <div key={s} className={`rounded-xl border p-2.5 ${g ? 'border-ok-line bg-ok-bg' : 'border-line'}`}>
                <p className="text-xs text-muted">{t(`sg.side.${s}` as never)}</p>
                {g ? <><img src={g.img} alt={t('sg.sigOf', { n: g.name })} className="h-12 w-full object-contain bg-white rounded-lg" /><p className="text-xs font-medium text-ok-fg">{g.name} · {N.dayTime(Date.parse(g.at))}</p></>
                  : <p className="text-sm text-muted py-3">{t('sg.notYet')}</p>}
              </div>) })}
          </div>
          {status === 'signed' && <p className="text-sm font-semibold text-ok-fg flex items-center gap-1.5" role="status"><Icon name="verified" size={16} />{t('sg.done')}</p>}
          {/* owner's blueprint: the contract as a file */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-soft text-sm" disabled={!!block} onClick={printIt}><Icon name="download" size={16} />{t('sg.pdf')}</button>
            <button type="button" className="btn-ghost text-sm" disabled={!!block} onClick={() => downloadContractDoc(docs, hash, companyName, workerName, sign)}><Icon name="documents" size={16} />{t('sg.doc')}</button>
            <span className="text-xs text-muted">{t('sg.pdf.hint')}</span>
          </div>
          {status === 'paperSigned' && sign?.paper && <p className="text-sm font-semibold text-ok-fg flex items-center gap-1.5" role="status"><Icon name="verified" size={16} />{t('sg.paperDone', { f: sign.paper.name })}</p>}
        </section>
        <section className="card space-y-3" aria-labelledby="sg-how">
          <h3 id="sg-how" className="h2">{t('sg.how.h')}</h3>
          <div role="tablist" aria-label={t('sg.how.h')} className="flex gap-1 rounded-xl border border-line bg-surface p-1">
            {(['online', 'paper'] as const).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => onMode(m)} className={`flex-1 min-h-[40px] px-3 rounded-lg text-sm inline-flex items-center justify-center gap-1.5 ${mode === m ? 'seg-on' : 'hover:bg-surface3'}`}><Icon name={m === 'online' ? 'edit' : 'documents'} size={15} />{t(`sg.mode.${m}` as never)}</button>)}
          </div>
          {mode === 'online' ? (<>
            <p className="text-xs text-muted">{t('sg.online.d')}</p>
            {sides.length > 1 && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{t('sg.as')}</span>
              {sides.map((s) => <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} className={`min-h-[36px] px-3 rounded-lg border text-sm ${side === s ? 'seg-on border-primary' : 'border-line hover:bg-surface3'}`}>{t(`sg.side.${s}` as never)}</button>)}</div>}
            {sign && sign.hash === hash && sign[side]
              ? <p className="text-sm text-ok-fg">{t('sg.already', { s: t(`sg.side.${side}` as never) })}</p>
              : <SignaturePad key={side} disabled={!!block} defaultName={side === 'worker' ? workerName : companyName} onDone={(name, img) => onSign(side, name, img)} />}
            <p className="text-xs text-muted">{t('sg.law')}</p>
          </>) : (<>
            <p className="text-xs text-muted">{t('sg.paper.d')}</p>
            <button type="button" className="btn-soft" disabled={!!block} onClick={printIt}><Icon name="download" size={16} />{t('sg.print')}</button>
            <label className={`btn-ghost cursor-pointer ${block ? 'pointer-events-none opacity-60' : ''}`}><Icon name="documents" size={16} />{t(sign?.paper && sign.hash === hash ? 'sg.paper.replace' : 'sg.paper.attach')}
              <input type="file" className="sr-only" accept="image/jpeg,image/png,application/pdf" disabled={!!block} onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPaper(f) }} /></label>
          </>)}
        </section>
      </div>
    </div>
  )
}

/** a box to draw a signature with a finger, pen or mouse, plus the printed name */
function SignaturePad({ defaultName, disabled, onDone }: { defaultName: string; disabled: boolean; onDone: (name: string, img: string) => void }) {
  const { t } = useI18n()
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [drawn, setDrawn] = useState(false)
  const [name, setName] = useState(defaultName)
  const [agree, setAgree] = useState(false)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr))
    const g = c.getContext('2d'); if (!g) return
    g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1e1b4b'
  }, [])
  const pos = (e: RPointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const }
  const down = (e: RPointerEvent<HTMLCanvasElement>) => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const g = e.currentTarget.getContext('2d'); const [x, y] = pos(e); g?.beginPath(); g?.moveTo(x, y) }
  const move = (e: RPointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const g = e.currentTarget.getContext('2d'); const [x, y] = pos(e); g?.lineTo(x, y); g?.stroke(); setDrawn(true) }
  const up = () => { drawing.current = false }
  const clear = () => { const c = ref.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); setDrawn(false) }
  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm"><span className="font-medium">{t('sg.name')}</span><input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} /></label>
      <div className="relative">
        <canvas ref={ref} className="w-full h-36 rounded-xl border-2 border-dashed border-control bg-white touch-none" aria-label={t('sg.pad')}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        {!drawn && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">{t('sg.pad')}</span>}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={disabled} /><span>{t('sg.agree')}</span></label>
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" className="btn-ghost text-sm" onClick={clear} disabled={disabled || !drawn}><Icon name="eraser" size={15} />{t('sg.clear')}</button>
        <button type="button" className="btn-primary" disabled={disabled || !drawn || !agree || name.trim().length < 2} onClick={() => { const c = ref.current; if (c) onDone(name, c.toDataURL('image/png')) }}><Icon name="edit" size={16} />{t('sg.sign')}</button>
      </div>
    </div>
  )
}

type Signed = SignState | null
/**
 * The contract as one HTML page in both languages, with signature lines (or the signatures given on screen) and the fingerprint.
 * Owner's blueprint (27 Nov 2026): it can be saved as a PDF (the print window's "Save as PDF") or downloaded as a Word file (.doc —
 * Word opens this page as a document). Made in the browser: free, nothing is uploaded.
 */
export function contractHtml(docs: Record<'th' | 'zh', string[]>, hash: string, company: string, worker: string, sign: Signed = null): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
  const col = (lg: Lang) => `<div lang="${lg === 'zh' ? 'zh-CN' : 'th'}"><h2>${esc(tr('sg.print.h' as never, undefined, lg))}</h2><ol>${docs[lg as 'th' | 'zh'].map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`
  const given = (s: 'worker' | 'employer') => (sign && sign.hash === hash ? sign[s] : undefined)
  const line = (s: 'worker' | 'employer', who: string) => { const g = given(s), label = `${tr(`sg.side.${s}` as never, undefined, 'th')} · ${tr(`sg.side.${s}` as never, undefined, 'zh')}`
    return `<div class="sig">${g && /^data:image\/(png|jpeg);base64,/.test(g.img) ? `<img src="${g.img}" alt="" style="height:48px">` : '<div class="ln"></div>'}<p>${esc(label)}</p><p>${esc(g?.name ?? who)}</p><p>${g ? esc(new Date(g.at).toISOString().slice(0, 10)) : `${esc(tr('sg.print.date' as never, undefined, 'th'))} ____ / ____ / ______`}</p></div>` }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tr('sg.print.title' as never, undefined, 'th'))}</title><style>
    body{font-family:'Noto Sans Thai','Sarabun','Microsoft YaHei',sans-serif;margin:24px;color:#111;font-size:13px;line-height:1.6}
    h1{font-size:18px;margin:0 0 4px} h2{font-size:15px;margin:12px 0 6px} .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    ol{padding-left:18px} li{margin-bottom:6px} .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
    .ln{border-bottom:1px solid #111;height:48px} .sig p{margin:4px 0} .fp{margin-top:24px;font-size:11px;color:#444;word-break:break-all}
  </style></head><body><h1>${esc(tr('sg.print.title' as never, undefined, 'th'))} · ${esc(tr('sg.print.title' as never, undefined, 'zh'))}</h1>
  <div class="cols">${col('th')}${col('zh')}</div>
  <div class="sigs">${line('worker', worker)}${line('employer', company)}</div>
  <p class="fp">${esc(tr('sg.print.fp' as never, undefined, 'th'))} SHA-256: ${esc(hash)}</p></body></html>`
}
/** opens the contract in a new window and the print dialog (print on paper, or "Save as PDF") */
export function printContract(docs: Record<'th' | 'zh', string[]>, hash: string, company: string, worker: string, sign: Signed = null) {
  const w = window.open('', '_blank'); if (!w) return
  w.document.write(contractHtml(docs, hash, company, worker, sign))
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
}
/** downloads the contract as a Word file (.doc) */
export function downloadContractDoc(docs: Record<'th' | 'zh', string[]>, hash: string, company: string, worker: string, sign: Signed = null) {
  const blob = new Blob(['﻿', contractHtml(docs, hash, company, worker, sign)], { type: 'application/msword' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `contract-${hash.slice(0, 8)}.doc`
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export { addSignature }
