import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go } from '../store'
import { rememberNext, useAuth, type AuthResult } from '../auth'
import { Icon, type IconName } from '../components/icons'
import { Warn } from '../components/ui'
import { useFieldError, type FieldError } from './match'

/*
 * Sign-in pages (owner, Oct 2026, after a reference he liked: "Welcome back!", e-mail and password with a show/hide eye,
 * "Forgot password?", one big button, "or", Google, "Don't have an account? Sign up"). E-mail + password works everywhere,
 * also in mainland China where Google is blocked. Errors sit under their field (WCAG 3.3.1) and focus moves to it.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** where to go after signing in: ?next=… (in-site routes only) — kept across the Google round trip */
function useNext() {
  const next = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('next') ?? ''
  return /^[a-z-]*(\?[\w=&-]*)?$/.test(next) ? next : ''
}

function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="auth-card rounded-3xl overflow-hidden border border-line">
        <div className="auth-hero relative px-6 pt-9 pb-14">
          <span className="auth-ring" aria-hidden />
          <h1 className="text-3xl font-bold leading-tight">{title}</h1>
          <p className="mt-1.5 opacity-90">{sub}</p>
          <svg className="auth-wave absolute -bottom-px left-0 w-full h-8" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden><path d="M0 18 C110 46 230 -6 400 20 L400 40 L0 40 Z" /></svg>
        </div>
        <div className="px-6 pb-7 pt-2 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ id, label, icon, value, onChange, fe, type = 'text', autoComplete, hint, reveal }: {
  id: string; label: string; icon: IconName; value: string; onChange: (v: string) => void; fe: FieldError; type?: string; autoComplete: string; hint?: string; reveal?: boolean
}) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <Icon name={icon} size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input id={id} className={`input !pl-10 ${reveal ? '!pr-12' : ''}`} type={reveal && show ? 'text' : type} autoComplete={autoComplete} value={value}
          onChange={(e) => { onChange(e.target.value); fe.clear() }} aria-invalid={fe.invalid(id)} aria-describedby={fe.describe(id, ...(hint ? [`${id}-hint`] : []))} />
        {reveal && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface3"
          aria-label={t('m.lg.show')} aria-pressed={show} onClick={() => setShow((s) => !s)}><Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button>}
      </div>
      {hint && <span id={`${id}-hint`} className="block text-xs text-muted mt-1">{hint}</span>}
      {fe.msg(id)}
    </div>
  )
}

function GoogleButton({ next }: { next: string }) {
  const { t } = useI18n()
  const { signInGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AuthResult | null>(null)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden><span className="h-px flex-1 bg-line" />{t('m.lg.or')}<span className="h-px flex-1 bg-line" /></div>
      <button type="button" className="btn-ghost w-full justify-center" disabled={busy}
        onClick={async () => { setBusy(true); setErr(null); rememberNext(next); const r = await signInGoogle(); if (r !== 'ok') { setErr(r); setBusy(false) } }}>
        <GoogleMark />{t('m.auth.google')}</button>
      <p className="text-xs text-muted">{t('m.auth.china')}</p>
      <div role="status">{err && <p className="text-sm text-danger-fg">{t(err === 'unavailable' ? 'm.auth.fail' : 'm.lg.err.error')}</p>}</div>
    </div>
  )
}
/** Google "G" mark, drawn inline so no image is fetched from Google before the visitor chooses Google */
export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="bg-white rounded-full p-0.5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
/** accounts not set up, or the service is down: say so instead of a form that cannot work */
function Unavailable() {
  const { t } = useI18n()
  return <Warn tone="info">{t('m.auth.fail')}</Warn>
}
const errText = (r: AuthResult): 'm.lg.err.invalid' | 'm.lg.err.unconfirmed' | 'm.lg.err.rate' | 'm.lg.err.mailRate' | 'm.auth.fail' | 'm.lg.err.email' | 'm.rg.err.exists' | 'm.rg.err.weak' | 'm.lg.err.error' =>
  r === 'invalid' ? 'm.lg.err.invalid' : r === 'unconfirmed' ? 'm.lg.err.unconfirmed' : r === 'rate' ? 'm.lg.err.rate' : r === 'mailRate' ? 'm.lg.err.mailRate' : r === 'unavailable' ? 'm.auth.fail' : r === 'email' ? 'm.lg.err.email' : r === 'exists' ? 'm.rg.err.exists' : r === 'weak' ? 'm.rg.err.weak' : 'm.lg.err.error'

export function LoginPage() {
  const { t } = useI18n()
  const { status, online, signInEmail } = useAuth()
  const next = useNext()
  const [email, setEmail] = useState(''), [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState<AuthResult | null>(null)
  const fe = useFieldError()
  // already signed in (or just back from Google): carry on
  useEffect(() => { if (status === 'signedIn') go(next) }, [status, next])
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!EMAIL.test(email.trim())) return fe.set('lg-email', 'lg-email', t('m.lg.err.email'))
    if (!pw) return fe.set('lg-pw', 'lg-pw', t('m.lg.err.password'))
    setBusy(true); rememberNext(next)
    const r = await signInEmail(email, pw)
    setBusy(false)
    if (r !== 'ok') setErr(r)
  }
  return (
    <AuthShell title={t('m.lg.title')} sub={t('m.lg.sub')}>
      {status === 'off' || online === false ? <Unavailable /> : (<>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field id="lg-email" label={t('m.lg.email')} icon="mail" type="email" autoComplete="email" value={email} onChange={setEmail} fe={fe} />
          <Field id="lg-pw" label={t('m.lg.password')} icon="lock" type="password" autoComplete="current-password" value={pw} onChange={setPw} fe={fe} reveal />
          <div className="flex justify-end -mt-2"><NavLink to="forgot" className="text-sm font-medium text-primary underline-offset-4 hover:underline min-h-[24px] inline-flex items-center">{t('m.lg.forgot')}</NavLink></div>
          <div role="status">{err && <p className="text-sm text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={15} />{t(errText(err))}</p>}</div>
          <button type="submit" className="cta-core w-full justify-center" disabled={busy}>{busy ? t('m.lg.busy') : t('m.lg.go')}</button>
        </form>
        <GoogleButton next={next} />
        <p className="text-sm text-center">{t('m.lg.noAccount')} <NavLink to={next ? `register?next=${next}` : 'register'} className="font-semibold text-primary underline underline-offset-4">{t('m.lg.register')}</NavLink></p>
      </>)}
    </AuthShell>
  )
}

export function RegisterPage() {
  const { t } = useI18n()
  const { status, online, signUp } = useAuth()
  const next = useNext()
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false), [err, setErr] = useState<AuthResult | null>(null)
  const fe = useFieldError()
  useEffect(() => { if (status === 'signedIn') go(next || 'choose-role') }, [status, next])
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    const n = name.trim()
    if (n.length < 2 || n.length > 60) return fe.set('rg-name', 'rg-name', t('m.rg.err.name'))
    if (!EMAIL.test(email.trim())) return fe.set('rg-email', 'rg-email', t('m.lg.err.email'))
    if (pw.length < 8) return fe.set('rg-pw', 'rg-pw', t('m.rg.err.weak'))
    if (pw !== pw2) return fe.set('rg-pw2', 'rg-pw2', t('m.rg.err.match'))
    if (!agree) return fe.set('rg-agree', 'rg-agree', t('m.rg.err.consent'))
    setBusy(true); rememberNext(next || 'choose-role')
    const r = await signUp(n, email, pw)
    setBusy(false)
    if (r !== 'ok') setErr(r)
  }
  return (
    <AuthShell title={t('m.rg.title')} sub={t('m.rg.sub')}>
      {status === 'off' || online === false ? <Unavailable /> : (<>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field id="rg-name" label={t('m.rg.name')} icon="user" autoComplete="name" value={name} onChange={setName} fe={fe} hint={t('m.rg.nameHint')} />
          <Field id="rg-email" label={t('m.lg.email')} icon="mail" type="email" autoComplete="email" value={email} onChange={setEmail} fe={fe} />
          <Field id="rg-pw" label={t('m.lg.password')} icon="lock" type="password" autoComplete="new-password" value={pw} onChange={setPw} fe={fe} hint={t('m.rg.pwHint')} reveal />
          <Field id="rg-pw2" label={t('m.rg.password2')} icon="lock" type="password" autoComplete="new-password" value={pw2} onChange={setPw2} fe={fe} reveal />
          <p className="text-xs text-muted">{t('m.auth.d')}</p>
          <div>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer min-h-[24px]">
              <input id="rg-agree" type="checkbox" className="mt-0.5 w-5 h-5 accent-[rgb(var(--primary))]" checked={agree} onChange={(e) => { setAgree(e.target.checked); fe.clear() }} aria-invalid={fe.invalid('rg-agree')} aria-describedby={fe.describe('rg-agree')} />
              <span>{t('m.rg.consent')} · <NavLink to="privacy" className="text-primary underline underline-offset-4">{t('m.auth.privacy')}</NavLink></span>
            </label>
            {fe.msg('rg-agree')}
          </div>
          <div role="status">{err && <p className="text-sm text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={15} />{t(errText(err))}</p>}</div>
          <button type="submit" className="cta-core w-full justify-center" disabled={busy}>{busy ? t('m.lg.busy') : t('m.rg.go')}</button>
        </form>
        <GoogleButton next={next || 'choose-role'} />
        <p className="text-sm text-center">{t('m.rg.have')} <NavLink to={next ? `login?next=${next}` : 'login'} className="font-semibold text-primary underline underline-offset-4">{t('m.lg.go')}</NavLink></p>
      </>)}
    </AuthShell>
  )
}

export function ForgotPage() {
  const { t } = useI18n()
  const { status, online, sendReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [err, setErr] = useState<AuthResult | null>(null)
  const fe = useFieldError()
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!EMAIL.test(email.trim())) return fe.set('fp-email', 'fp-email', t('m.lg.err.email'))
    setBusy(true)
    const r = await sendReset(email)
    setBusy(false)
    // the same answer whether or not the address has an account (nobody can test which e-mails are registered)
    if (r === 'ok' || r === 'invalid' || r === 'unconfirmed' || r === 'email') setSent(true); else setErr(r)
  }
  return (
    <AuthShell title={t('m.fp.title')} sub={t('m.fp.sub')}>
      {status === 'off' || online === false ? <Unavailable /> : sent ? <Warn tone="info">{t('m.fp.sent')}</Warn> : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field id="fp-email" label={t('m.lg.email')} icon="mail" type="email" autoComplete="email" value={email} onChange={setEmail} fe={fe} />
          <div role="status">{err && <p className="text-sm text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={15} />{t(errText(err))}</p>}</div>
          <button type="submit" className="cta-core w-full justify-center" disabled={busy}>{busy ? t('m.lg.busy') : t('m.fp.go')}</button>
        </form>)}
      <p className="text-sm text-center"><NavLink to="login" className="font-semibold text-primary underline underline-offset-4">{t('m.fp.back')}</NavLink></p>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { t } = useI18n()
  const { status, recovery, updatePassword } = useAuth()
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [err, setErr] = useState<AuthResult | null>(null)
  const fe = useFieldError()
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null)
    if (pw.length < 8) return fe.set('rp-pw', 'rp-pw', t('m.rg.err.weak'))
    if (pw !== pw2) return fe.set('rp-pw2', 'rp-pw2', t('m.rg.err.match'))
    setBusy(true)
    const r = await updatePassword(pw)
    setBusy(false)
    if (r === 'ok') setDone(true); else setErr(r)
  }
  // the e-mail link signs the visitor in for this one purpose; without it there is nothing to change here
  const can = recovery || status === 'signedIn'
  return (
    <AuthShell title={t('m.rp.title')} sub={t('m.rg.pwHint')}>
      {status === 'loading' ? <p className="text-muted" role="status">{t('c.loading')}</p>
        : done ? (<><Warn tone="info">{t('m.rp.done')}</Warn><NavLink to="" className="cta-core w-full justify-center">{t('m.home')}</NavLink></>)
        : !can ? (<><Warn>{t('m.rp.invalid')}</Warn><NavLink to="forgot" className="btn-ghost w-full justify-center">{t('m.fp.title')}</NavLink></>)
        : (
          <form className="space-y-4" onSubmit={submit} noValidate>
            <Field id="rp-pw" label={t('m.rp.new')} icon="lock" type="password" autoComplete="new-password" value={pw} onChange={setPw} fe={fe} reveal />
            <Field id="rp-pw2" label={t('m.rg.password2')} icon="lock" type="password" autoComplete="new-password" value={pw2} onChange={setPw2} fe={fe} reveal />
            <div role="status">{err && <p className="text-sm text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={15} />{t(errText(err))}</p>}</div>
            <button type="submit" className="cta-core w-full justify-center" disabled={busy}>{busy ? t('m.lg.busy') : t('m.rp.go')}</button>
          </form>)}
    </AuthShell>
  )
}

/** shown instead of a page that needs an account: sign in or sign up, and come back here afterwards */
export function NeedLogin({ here }: { here: string }) {
  const { t } = useI18n()
  return (
    <div className="glass-card p-6 flex flex-col items-center text-center gap-3 max-w-md mx-auto !py-9">
      <span className="w-12 h-12 rounded-2xl bg-brand text-brandfg grid place-items-center"><Icon name="lock" size={22} /></span>
      <h2 className="h2">{t('m.need.title')}</h2>
      <p className="text-muted">{t('m.need.d')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <NavLink to={`login?next=${here}`} className="btn-primary">{t('m.lg.go')}</NavLink>
        <NavLink to={`register?next=${here}`} className="btn-ghost">{t('m.lg.register')}</NavLink>
      </div>
    </div>
  )
}
