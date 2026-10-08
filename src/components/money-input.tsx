/**
 * A money amount field that shows thousands separators while typing (owner, Oct 2026: "20000" next to "2500" is easy to misread;
 * "20,000" and "2,500" are not). The value given and returned is digits only ("20000"), so the forms keep using Number(value).
 */
import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'

const MAX_DIGITS = 9
export const digitsOnly = (s: string) => s.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS)
export const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: string; onValue: (digits: string) => void }

export function MoneyInput({ value, onValue, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  // keep the caret after the same digit when a comma appears or disappears in front of it
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current, n = caret.current
    if (!el || n === null || document.activeElement !== el) return
    caret.current = null
    let pos = 0, seen = 0
    while (pos < el.value.length && seen < n) { if (/\d/.test(el.value[pos])) seen++; pos++ }
    el.setSelectionRange(pos, pos)
  })
  return (
    <input {...rest} ref={ref} type="text" inputMode="numeric" autoComplete="off" value={withCommas(digitsOnly(value))}
      onChange={(e) => {
        const el = e.target
        caret.current = digitsOnly(el.value.slice(0, el.selectionStart ?? el.value.length)).length
        onValue(digitsOnly(el.value))
      }} />
  )
}
