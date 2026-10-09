import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GoogleIdButton, googleClientOk } from './components/google-signin'
import { GET, POST, readGooglePost } from '../api/google'

describe('phones: back from Google\'s page (api/google.ts)', () => {
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'
  const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null })
  it('passes on a token-shaped credential; the CSRF cookie must match when it came along', () => {
    expect(readGooglePost(form({ credential: jwt, g_csrf_token: 'abc' }), 'g_csrf_token=abc; other=1')).toBe(jwt)
    expect(readGooglePost(form({ credential: jwt, g_csrf_token: 'abc' }), null)).toBe(jwt) // the nonce still guards it
    expect(readGooglePost(form({ credential: jwt, g_csrf_token: 'abc' }), 'g_csrf_token=zzz')).toBeNull()
    expect(readGooglePost(form({ credential: 'not a token' }), null)).toBeNull()
    expect(readGooglePost(form({ credential: jwt + '#x' }), null)).toBeNull()
    expect(readGooglePost(form({}), null)).toBeNull()
  })
  it('sends the token back in the address fragment (never to a server), or an error mark', async () => {
    const ok = await POST(new Request('https://x.test/api/google', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: 'g_csrf_token=t' }, body: `credential=${jwt}&g_csrf_token=t` }))
    expect(ok.status).toBe(303); expect(ok.headers.get('location')).toBe('/login#gcred=' + jwt); expect(ok.headers.get('cache-control')).toBe('no-store')
    const bad = await POST(new Request('https://x.test/api/google', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'credential=nope' }))
    expect(bad.headers.get('location')).toBe('/login?gerr=1')
    expect(GET().headers.get('location')).toBe('/login?gerr=1') // a plain visit instead of Google's form: the page says why
  })
})

describe("Google's own sign-in button (Google shows our site, not the Supabase address)", () => {
  it('accepts only a real-looking public client ID', () => {
    expect(googleClientOk('123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com')).toBe(true)
    expect(googleClientOk('')).toBe(false)
    expect(googleClientOk('GOCSPX-secret-looking-value')).toBe(false) // a client secret must never go here
    expect(googleClientOk('https://evil.example/123-abc.apps.googleusercontent.com')).toBe(false)
  })
  it('without a client ID the old redirect button shows', () => {
    const html = renderToStaticMarkup(<GoogleIdButton lang="th" onBefore={() => {}} onToken={() => {}} fallback={<button type="button">old</button>} />)
    expect(html).toContain('>old</button>')
  })
})
