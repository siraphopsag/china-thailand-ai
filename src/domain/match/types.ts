/**
 * C.A.L.L. matching prototype (owner's model, Oct 2026): job seekers pin up to 5 provinces with their skills; employers post what
 * they need for a province; posts reach seekers in steps (same area + same field → same area → whole country); a seeker accepts;
 * the admin forwards the case to the employment authority (simulated — nothing is sent anywhere).
 * Everything here is synthetic prototype data kept in this browser. No identity documents or contact details are collected.
 */
import { INDUSTRIES, SKILLS, type Industry, type Skill } from '../jobboard/types'

export { INDUSTRIES, SKILLS, type Industry, type Skill }
export type Country = 'TH' | 'CN'
export const COUNTRIES: Country[] = ['TH', 'CN']
export type Role = 'seeker' | 'employer'

export interface Place { country: Country; province: string }
/** a pinned destination: "I want this kind of work here" */
export interface Pin extends Place { id: string; industry: Industry; skills: Skill[]; at: string }
export const MAX_PINS = 5

export interface Seeker {
  id: string
  /** shown to the admin; for sample seekers an invented first name, for "you" a fixed label */
  name: string
  origin: Place | null
  pins: Pin[]
  synthetic: true
}
export interface Post extends Place {
  id: string
  employerId: string
  company: string
  position: string
  industry: Industry
  skills: Skill[]
  minYears: number
  details: string
  createdAt: string
  synthetic: true
}
/** a seeker took a post; the admin then forwards it to the employment authority (simulated) */
export interface Acceptance { id: string; postId: string; seekerId: string; at: string; status: 'accepted' | 'forwarded'; forwardedAt?: string }

export interface MatchState {
  version: 1
  role: Role | null
  /** demo clock: days added to the real time, so the step-by-step release can be shown without waiting */
  dayOffset: number
  me: Seeker
  myCompany: string
  seekers: Seeker[]
  posts: Post[]
  acceptances: Acceptance[]
}

/** step of the release: 1 = pinned area + same field, 2 = pinned area (any field), 3 = whole destination country */
export type Tier = 1 | 2 | 3
export const ME = 'me'
export const MY_EMPLOYER = 'employer:me'
