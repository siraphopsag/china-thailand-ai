// Photos on profiles (owner, 28 Nov 2026): a profile picture, a cover and up to 6 photos of work (job seekers) or of the shop or
// workplace (employers). Every photo is shrunk and re-drawn in the browser before it leaves the device, which also drops its hidden
// data (where and when it was taken). Signed in, the photos go to a private storage bucket (SQL 0025) and are shown through
// short-lived links to the people allowed to see them; in the local demo and the offline kit they stay in this browser.
import { useCallback, useEffect, useState } from 'react'
import { getClient, useAuth } from './auth'
import { useMatch } from './matchData'
import { isUuid, type SyncProblem } from './shared'

export const BUCKET = 'profile-media'
export const MAX_GALLERY = 6
/** bigger files are refused before any work (a phone photo is usually 2–8 MB) */
export const MAX_INPUT = 15 * 1024 * 1024
export type MediaKind = 'avatar' | 'cover' | 'gallery'
export interface Photo { key: string; url: string }
export interface Media { avatar: string | null; cover: string | null; gallery: Photo[] }
const EMPTY: Media = { avatar: null, cover: null, gallery: [] }
const EVT = 'call-media'
const LOCAL = 'call.media.v1'

/** the size each kind is drawn at: square for the picture, 3:1 for the cover, the long side for work photos */
export const SHAPE: Record<MediaKind, { w: number; h: number; crop: boolean }> = {
  avatar: { w: 400, h: 400, crop: true }, cover: { w: 1500, h: 500, crop: true }, gallery: { w: 1280, h: 1280, crop: false },
}
/** where a photo is kept: <user>/avatar.webp, <user>/cover.webp, <user>/g/<time>.webp */
export const pathOf = (uid: string, kind: MediaKind, stamp = Date.now()) => (kind === 'gallery' ? `${uid}/g/${stamp}.webp` : `${uid}/${kind}.webp`)
/** the drawn size for a picture of w × h: cropped to fill, or fitted inside, never enlarged */
export function fitBox(w: number, h: number, kind: MediaKind): { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number } {
  const s = SHAPE[kind]
  if (s.crop) {
    const want = s.w / s.h, have = w / h
    const sw = have > want ? Math.round(h * want) : w, sh = have > want ? h : Math.round(w / want)
    const scale = Math.min(1, s.w / sw)
    return { sx: Math.round((w - sw) / 2), sy: Math.round((h - sh) / 2), sw, sh, dw: Math.round(sw * scale), dh: Math.round(sh * scale) }
  }
  const scale = Math.min(1, s.w / Math.max(w, h))
  return { sx: 0, sy: 0, sw: w, sh: h, dw: Math.round(w * scale), dh: Math.round(h * scale) }
}
/** shrink and re-draw a picture (drops its hidden data); WebP where the browser can, otherwise JPEG */
export async function shrink(file: Blob, kind: MediaKind, quality = 0.82): Promise<Blob> {
  const img = await createImageBitmap(file)
  const b = fitBox(img.width, img.height, kind)
  const c = document.createElement('canvas'); c.width = b.dw; c.height = b.dh
  const g = c.getContext('2d'); if (!g) throw new Error('canvas')
  g.drawImage(img, b.sx, b.sy, b.sw, b.sh, 0, 0, b.dw, b.dh); img.close()
  const as = (type: string) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, quality))
  const webp = await as('image/webp')
  const out = webp && webp.type === 'image/webp' ? webp : await as('image/jpeg')
  if (!out) throw new Error('encode')
  return out
}
const toDataUrl = (b: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(b) })
const readLocal = (): Media => { try { const v = JSON.parse(localStorage.getItem(LOCAL) ?? 'null'); return v && typeof v === 'object' ? { ...EMPTY, ...v, gallery: Array.isArray(v.gallery) ? v.gallery : [] } : EMPTY } catch { return EMPTY } }
const writeLocal = (m: Media) => { localStorage.setItem(LOCAL, JSON.stringify(m)); window.dispatchEvent(new Event(EVT)) }
const missing = (e: unknown) => /bucket not found|not found|does not exist|42883/i.test(`${(e as Error)?.message ?? ''}`)

/**
 * A person's photos: `owner` is 'me' or another person's account id. Others' photos load only when the database allows it
 * (0025); in the local demo only my own exist. Returns the photos, what went wrong, and (for 'me') how to add and remove them.
 */
export function useMedia(owner: string) {
  const { mode } = useMatch()
  const { user } = useAuth()
  const mine = owner === 'me' || owner === user?.id
  const uid = owner === 'me' ? user?.id ?? null : owner
  const remote = mode === 'remote' && isUuid(uid)
  const [m, setM] = useState<Media>(EMPTY)
  const [problem, setProblem] = useState<SyncProblem>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => { const on = () => setTick((x) => x + 1); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [])
  useEffect(() => {
    if (!remote) return
    let alive = true
    void (async () => {
      try {
        const sb = await getClient(), bk = sb.storage.from(BUCKET)
        const [top, gal] = await Promise.all([bk.list(uid!), bk.list(`${uid}/g`, { sortBy: { column: 'name', order: 'asc' } })])
        if (top.error) throw top.error
        const names = new Set((top.data ?? []).map((x) => x.name))
        const paths = [...(names.has('avatar.webp') ? [`${uid}/avatar.webp`] : []), ...(names.has('cover.webp') ? [`${uid}/cover.webp`] : []),
          ...(gal.data ?? []).filter((x) => x.name.endsWith('.webp')).slice(0, MAX_GALLERY).map((x) => `${uid}/g/${x.name}`)]
        if (!paths.length) { if (alive) { setM(EMPTY); setProblem(null) } return }
        const { data, error } = await bk.createSignedUrls(paths, 3600)
        if (error) throw error
        const url = (p: string) => data?.find((x) => x.path === p)?.signedUrl ?? null
        if (alive) {
          setM({ avatar: url(`${uid}/avatar.webp`), cover: url(`${uid}/cover.webp`),
            gallery: paths.filter((p) => p.includes('/g/')).flatMap((p) => { const u = url(p); return u ? [{ key: p, url: u }] : [] }) })
          setProblem(null)
        }
      } catch (e) { if (alive) setProblem(missing(e) ? 'dbOld' : 'network') }
    })()
    return () => { alive = false }
  }, [remote, uid, tick])
  const add = useCallback(async (kind: MediaKind, file: File): Promise<'ok' | 'type' | 'big' | 'full' | SyncProblem> => {
    if (!mine) return 'network'
    if (!file.type.startsWith('image/')) return 'type'
    if (file.size > MAX_INPUT) return 'big'
    if (kind === 'gallery' && (remote ? m : readLocal()).gallery.length >= MAX_GALLERY) return 'full'
    try {
      if (!remote) {
        // the local copy is smaller so a few photos fit in the browser's storage
        const url = await toDataUrl(await shrink(file, kind, 0.7))
        const cur = readLocal()
        writeLocal(kind === 'gallery' ? { ...cur, gallery: [...cur.gallery, { key: `g-${Date.now()}`, url }] } : { ...cur, [kind]: url })
        return 'ok'
      }
      const blob = await shrink(file, kind)
      const sb = await getClient()
      const { error } = await sb.storage.from(BUCKET).upload(pathOf(uid!, kind), blob, { upsert: true, contentType: blob.type, cacheControl: '60' })
      if (error) throw error
      window.dispatchEvent(new Event(EVT)); return 'ok'
    } catch (e) { return missing(e) ? 'dbOld' : (e as Error)?.name === 'QuotaExceededError' ? 'big' : 'network' }
  }, [mine, remote, uid, m])
  const remove = useCallback(async (key: 'avatar' | 'cover' | string): Promise<SyncProblem> => {
    if (!mine) return 'network'
    try {
      if (!remote) { const cur = readLocal(); writeLocal(key === 'avatar' || key === 'cover' ? { ...cur, [key]: null } : { ...cur, gallery: cur.gallery.filter((x) => x.key !== key) }); return null }
      const sb = await getClient()
      const path = key === 'avatar' || key === 'cover' ? `${uid}/${key}.webp` : key
      const { error } = await sb.storage.from(BUCKET).remove([path])
      if (error) throw error
      window.dispatchEvent(new Event(EVT)); return null
    } catch (e) { return missing(e) ? 'dbOld' : 'network' }
  }, [mine, remote, uid])
  const media = remote ? m : mine ? readLocal() : EMPTY
  return { media, problem: remote ? problem : null, mine, add, remove, tick }
}
