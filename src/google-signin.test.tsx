import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GoogleIdButton, googleClientOk } from './components/google-signin'

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
