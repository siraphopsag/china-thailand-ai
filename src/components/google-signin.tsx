/**
 * Google's own "Sign in with Google" button (Google Identity Services), owner Oct 2026: the old redirect went through Supabase, so
 * Google's screen said "to continue to qdhdaxompcnjvurxlpzf.supabase.co", which looked untrustworthy. With this button Google
 * shows our site instead, gives us an ID token, and Supabase signs the person in with it (signInWithIdToken) — free, no new service.
 * Needs VITE_GOOGLE_CLIENT_ID (the public client ID of the same Google OAuth client Supabase uses, not a secret) and the site's
 * addresses under "Authorized JavaScript origins" in Google Cloud (docs/setup-login.md, step 19).
 * Google's script is loaded only on the sign-in pages. If it cannot load (no client ID, Google blocked, offline), the old button shows.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

type IdApi = {
  initialize: (o: Record<string, unknown>) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
}
declare global { interface Window { google?: { accounts?: { id?: IdApi } } } }

export const GOOGLE_CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim()
export const googleClientOk = (id: string) => /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)
const SRC = 'https://accounts.google.com/gsi/client'

let scriptP: Promise<IdApi> | null = null
function loadGis(): Promise<IdApi> {
  return (scriptP ??= new Promise<IdApi>((ok, fail) => {
    const done = () => { const api = window.google?.accounts?.id; if (api) ok(api); else fail(new Error('gis')) }
    if (window.google?.accounts?.id) return done()
    const s = document.createElement('script')
    s.src = SRC; s.async = true; s.defer = true
    const tm = window.setTimeout(() => fail(new Error('timeout')), 8000)
    s.onload = () => { window.clearTimeout(tm); done() }
    s.onerror = () => { window.clearTimeout(tm); fail(new Error('load')) }
    document.head.appendChild(s)
  }).catch((e) => { scriptP = null; throw e }))
}

/** a fresh random nonce: Google gets its SHA-256, Supabase gets the raw value and checks they match (no replayed tokens) */
async function makeNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return { raw, hashed: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('') }
}

const GSI_LOCALE = { th: 'th', zh: 'zh_CN', en: 'en' } as const

function useLight() {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const read = () => setLight(document.documentElement.getAttribute('data-theme') === 'light')
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return light
}

/**
 * Renders Google's button; `onToken` gets the ID token and the raw nonce. Until the button is ready (and for good if it cannot be),
 * `fallback` is shown — the old redirect button.
 */
export function GoogleIdButton({ lang, onBefore, onToken, fallback }: { lang: 'th' | 'zh' | 'en'; onBefore: () => void; onToken: (token: string, nonce: string) => void; fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'off'>(googleClientOk(GOOGLE_CLIENT_ID) ? 'loading' : 'off')
  const light = useLight()
  const cb = useRef({ onBefore, onToken })
  cb.current = { onBefore, onToken }
  useEffect(() => {
    if (!googleClientOk(GOOGLE_CLIENT_ID)) return
    let live = true
    const setup = async () => {
      const [api, nonce] = await Promise.all([loadGis(), makeNonce()])
      if (!live || !box.current) return
      api.initialize({
        client_id: GOOGLE_CLIENT_ID, nonce: nonce.hashed, ux_mode: 'popup', auto_select: false, itp_support: true, use_fedcm_for_button: true,
        callback: (r: { credential?: string }) => {
          if (!r.credential) return
          cb.current.onToken(r.credential, nonce.raw)
          void setup() // a new nonce for the next try (a token can be used once)
        },
      })
      const width = Math.max(200, Math.min(400, Math.round(box.current.parentElement?.getBoundingClientRect().width || 320)))
      box.current.replaceChildren()
      api.renderButton(box.current, { type: 'standard', theme: light ? 'outline' : 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', logo_alignment: 'center', width, locale: GSI_LOCALE[lang], click_listener: () => cb.current.onBefore() })
      setState('ready')
    }
    setup().catch(() => { if (live) setState('off') })
    return () => { live = false }
  }, [lang, light])
  return (
    <>
      {state !== 'ready' && fallback}
      <div ref={box} style={{ colorScheme: 'light' }} className={state === 'ready' ? 'flex justify-center min-h-[44px]' : 'hidden'} aria-hidden={state !== 'ready' || undefined} />
    </>
  )
}
