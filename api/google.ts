// Vercel serverless function: where Google sends people back after "Sign in with Google" on phones (owner, Oct 2026).
// On phones Google's button works by going to Google's page and coming back (the popup stayed white on iPhones). Google posts
// the ID token here as a form (credential, g_csrf_token); we hand it to the sign-in page in the address fragment (#gcred=…),
// which browsers never send to any server; the page removes it at once and signs in with Supabase (signInWithIdToken).
// The token is checked by Supabase (Google's signature, our client ID, and the nonce only the person's own tab knows — so a token
// posted by someone else cannot sign anyone in). Nothing is stored or logged here.
const back = (to: string) => new Response(null, { status: 303, headers: { Location: to, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

const cookie = (header: string | null, name: string) => {
  for (const part of (header ?? '').split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return decodeURIComponent(v.join('=')) }
  return ''
}

/** checks the form Google posted; the token to pass on, or null */
export function readGooglePost(form: { get: (k: string) => unknown }, cookieHeader: string | null): string | null {
  const credential = form.get('credential'), csrf = form.get('g_csrf_token')
  if (typeof credential !== 'string' || credential.length > 4096 || !JWT.test(credential)) return null
  // Google's double-submit check: when the cookie came along, it must match the form
  const c = cookie(cookieHeader, 'g_csrf_token')
  if (c && c !== csrf) return null
  return credential
}

export async function POST(request: Request) {
  let token: string | null = null
  try { token = readGooglePost(await request.formData(), request.headers.get('cookie')) } catch { token = null }
  return token ? back('/login#gcred=' + token) : back('/login?gerr=1')
}

export function GET() { return back('/login?gerr=1') }
