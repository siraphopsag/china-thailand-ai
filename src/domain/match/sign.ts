// Signing and partner review in the middle system (v2 model, owner Nov 2026). Either side may sign on screen or print the contract
// and sign on paper (the owner: "online or paper — the user chooses"). An on-screen signature binds to a fingerprint (SHA-256) of the
// exact contract text: if anyone changes a clause afterwards the fingerprint no longer matches and both signatures stop counting,
// which is what makes an electronic signature reliable under the Thai Electronic Transactions Act s.9 and the Chinese Electronic
// Signature Law Art. 13–14. A contract with a high-risk finding, or a worker whose passport does not match, cannot be signed.
// Before signing, either side may send the draft to a partner law firm in the country of work (sample firms in the prototype).
// Pure: no React, no storage.
import type { Country } from './types'

export type Side = 'worker' | 'employer'
export interface Signature { at: string; name: string; /** the drawn signature as a PNG data URL */ img: string }
export interface SignState {
  mode: 'online' | 'paper'
  /** fingerprint of the contract text the signatures belong to */
  hash: string
  worker?: Signature; employer?: Signature
  /** paper: the scan of the signed copy (only its name; the file stays on the device) */
  paper?: { name: string; size: number; at: string }
}
export type ReviewStatus = 'sent' | 'reviewing' | 'done'
export interface ReviewNote { kind: 'fix' | 'ok'; text: string }
export interface Review { firm: Country; status: ReviewStatus; sentAt: string; at: string; notes: ReviewNote[] }

/** SHA-256 of the text as lowercase hex (Web Crypto: browsers and Node 20+) */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
/** short form for the screen: first and last 8 characters */
export const shortHash = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h)

/** why signing is not possible yet (null = it is) */
export type SignBlock = 'notChecked' | 'contractRisk' | 'idNotChecked' | 'idProblem'
export function signBlock(s: { checked: boolean; contractHigh: number; idChecked: boolean; idHigh: number }): SignBlock | null {
  if (!s.checked) return 'notChecked'
  if (s.contractHigh > 0) return 'contractRisk'
  if (!s.idChecked) return 'idNotChecked'
  if (s.idHigh > 0) return 'idProblem'
  return null
}

/** where the signing stands for the current text */
export type SignStatus = 'none' | 'partial' | 'signed' | 'paperSigned' | 'changed'
export function signStatus(s: SignState | null, hash: string): SignStatus {
  if (!s || (!s.worker && !s.employer && !s.paper)) return 'none'
  if (s.hash !== hash) return 'changed'
  if (s.mode === 'paper') return s.paper ? 'paperSigned' : 'none'
  return s.worker && s.employer ? 'signed' : 'partial'
}

/** a signature is accepted only with a name and a drawing, on the text it was shown */
export function addSignature(s: SignState | null, side: Side, sig: Signature, hash: string): SignState | null {
  if (sig.name.trim().length < 2 || !sig.img.startsWith('data:image/png')) return null
  const base: SignState = s && s.hash === hash && s.mode === 'online' ? s : { mode: 'online', hash }
  if (base[side]) return null
  return { ...base, [side]: { ...sig, name: sig.name.trim() } }
}

/** the partner firm's reply in the demo: one fix per open finding, or a clean bill */
export function reviewNotes(findings: { text: string }[], okText: string): ReviewNote[] {
  return findings.length ? findings.map((f) => ({ kind: 'fix' as const, text: f.text })) : [{ kind: 'ok', text: okText }]
}
