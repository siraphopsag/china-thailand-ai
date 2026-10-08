import { describe, expect, it } from 'vitest'
import { digitsOnly, withCommas } from './components/money-input'

describe('money fields show thousands separators', () => {
  it('formats the digits with commas', () => {
    expect(withCommas('2500')).toBe('2,500')
    expect(withCommas('20000')).toBe('20,000')
    expect(withCommas('1234567')).toBe('1,234,567')
    expect(withCommas('999')).toBe('999')
    expect(withCommas('')).toBe('')
  })
  it('keeps digits only (what the form stores), no leading zeros, at most 9 digits', () => {
    expect(digitsOnly('20,000')).toBe('20000')
    expect(digitsOnly('฿ 2,5a00')).toBe('2500')
    expect(digitsOnly('007')).toBe('7')
    expect(digitsOnly('0')).toBe('0')
    expect(digitsOnly('12345678901')).toBe('123456789')
  })
})
