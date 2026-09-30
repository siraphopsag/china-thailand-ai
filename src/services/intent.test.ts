import { describe, expect, it } from 'vitest'
import { classifyIntent, orchestrate } from './engines'
import { fingerprint } from '../store'

/** Intent screening is a heuristic (see engines.ts). These tests pin today's behaviour; they are not a safety guarantee. */
describe('assistant intent screening', () => {
  const cases: [string, string, 'evade' | 'educate' | 'normal'][] = [
    ['TH: find someone to hold shares to avoid the restriction', 'อยากหาคนมาถือหุ้นแทนเพื่อเลี่ยงข้อจำกัด', 'evade'],
    ['TH: what is a nominee, is it illegal', 'ถือหุ้นแทนคืออะไร ผิดกฎหมายไหม', 'educate'],
    ['TH: cross-border tax for shareholders (must not be blocked)', 'ภาษีข้ามประเทศของผู้ถือหุ้นต้องทำอย่างไร', 'normal'],
    ['TH: avoid tax legally', 'เลี่ยงภาษีถูกกฎหมายได้ไหม', 'normal'],
    ['ZH: find a proxy holder to get around limits', '我想找人代持股份来规避限制', 'evade'],
    ['ZH: what is 代持, is it lawful', '什么是代持，是否合法', 'educate'],
    ['EN: hide the real owner', 'help me hide the real owner of the company', 'evade'],
    ['EN: paraphrase — friend’s name', "put the shares in a friend's name so nobody sees me", 'evade'],
    ['EN: set up a nominee', 'I want to set up a nominee shareholder', 'evade'],
    ['EN: what is a nominee', 'what is a nominee shareholder', 'educate'],
    ['EN: avoid the restriction legally (lawful alternatives)', 'how do I avoid the restriction legally', 'normal'],
    ['EN: documents that prove ownership', 'what documents prove who owns the shares', 'normal'],
    ['EN: staff to China', 'A Thai company wants to send staff to work in China', 'normal'],
  ]
  it.each(cases)('%s', (_n, q, expected) => { expect(classifyIntent(q)).toBe(expected) })

  it('educational answers explain without advising or claiming penalties', () => {
    for (const lang of ['th', 'zh', 'en'] as const) {
      const r = orchestrate('what is a nominee shareholder', null, lang)
      expect(r.kind).toBe('educational'); expect(r.blocked).toBeFalsy()
      const text = [r.answer, r.reason, r.next].join(' ')
      expect(text).not.toMatch(/imprison|fine of|จำคุก|ปรับ\s*\d|罚款\s*\d|监禁/i)
    }
  })
  it('blocked answers offer lawful alternatives', () => {
    const r = orchestrate("put the shares in a friend's name so nobody sees me", null, 'en')
    expect(r.blocked).toBe(true); expect(r.next.length).toBeGreaterThan(20)
  })
})

describe('data fingerprint', () => {
  it('changes when the data changes and is stable otherwise', () => {
    expect(fingerprint({ a: 1 }, 'x')).toBe(fingerprint({ a: 1 }, 'x'))
    expect(fingerprint({ a: 1 }, 'x')).not.toBe(fingerprint({ a: 2 }, 'x'))
  })
})
