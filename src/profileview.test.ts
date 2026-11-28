import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { MAX_GALLERY, fitBox, pathOf } from './mediaStore'
import { messages } from './locales'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

// owner, 28 Nov 2026: profiles like a social-network page (job seekers) and like a shop on a map (employers), with photos
describe('profile photos', () => {
  it('each kind has its own place in the person’s folder', () => {
    expect(pathOf('u1', 'avatar')).toBe('u1/avatar.webp'); expect(pathOf('u1', 'cover')).toBe('u1/cover.webp'); expect(pathOf('u1', 'gallery', 5)).toBe('u1/g/5.webp')
    expect(MAX_GALLERY).toBe(6)
  })
  it('photos are cropped or fitted and never enlarged', () => {
    expect(fitBox(4000, 3000, 'avatar')).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000, dw: 400, dh: 400 })
    expect(fitBox(3000, 3000, 'cover')).toMatchObject({ sw: 3000, sh: 1000, dw: 1500, dh: 500 })
    expect(fitBox(800, 600, 'gallery')).toMatchObject({ dw: 800, dh: 600 })
    expect(fitBox(4000, 2000, 'gallery')).toMatchObject({ dw: 1280, dh: 640 })
  })
  it('the database keeps photos private: own folder only for writing; employers public to signed-in people; job seekers only to employers they applied to', () => {
    const sql = src('../supabase/migrations/0025_profile_media.sql')
    expect(sql).toContain("values ('profile-media', 'profile-media', false,")
    expect(sql).toContain("with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)")
    expect(sql).toContain("pr.user_type = 'employer'")
    expect(sql).toContain('where a.seeker_id::text = p_owner and p.employer_id = auth.uid()')
    expect(src('../vercel.json')).toContain("img-src 'self' data: https://*.googleusercontent.com https://*.supabase.co;")
  })
  it('photos are re-drawn before upload (which drops where they were taken) and the pages link names to profiles', () => {
    expect(src('./mediaStore.ts')).toContain('g.drawImage(img, b.sx, b.sy, b.sw, b.sh, 0, 0, b.dw, b.dh)')
    expect(src('./App.tsx')).toContain('profile: <ProfilePage />')
    const post = src('./pages/post.tsx')
    expect(post).toContain('to={`profile?id=${encodeURIComponent(p.employerId)}&k=e`}'); expect(post).toContain('to={`profile?id=${encodeURIComponent(a.seekerId)}&k=s`}')
    expect(src('./pages/match.tsx')).toContain('<MyProfile />')
  })
  it('every new word exists in three languages', () => {
    for (const [k, v] of Object.entries(messages).filter(([k]) => k.startsWith('pv.') || k.startsWith('pf.'))) {
      expect(v[0], k).toMatch(/[฀-๿]|^\{|–/); expect(v[1], k).toBeTruthy(); expect(v[2], k).toMatch(/[A-Za-z{]/)
    }
  })
})
