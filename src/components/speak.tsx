// Hearing a word (owner, 24 Nov 2026: "users don't know how to pronounce the Chinese"). Uses the voices the phone or computer
// already has (the browser's speech synthesis): free, nothing is sent anywhere, no key. Where the device has no voice for the
// language, the button is not shown at all, so nobody presses a button that does nothing.
import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { useI18n } from '../i18n'

export type SayLang = 'zh' | 'th'
const TAG: Record<SayLang, string> = { zh: 'zh-CN', th: 'th-TH' }
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

/** the device's voice for the language (mainland Chinese first), or null */
export function pickVoice(voices: readonly Pick<SpeechSynthesisVoice, 'lang'>[], lang: SayLang) {
  const norm = (l: string) => l.toLowerCase().replace('_', '-')
  const want = TAG[lang].toLowerCase()
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).startsWith(`${lang}-`) || norm(v.lang) === lang) ?? null
}
function useVoice(lang: SayLang) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    const s = synth(); if (!s) return
    const load = () => setVoice(pickVoice(s.getVoices(), lang) as SpeechSynthesisVoice | null)
    load()
    s.addEventListener?.('voiceschanged', load)
    return () => s.removeEventListener?.('voiceschanged', load)
  }, [lang])
  return voice
}

export function SayButton({ text, lang, label }: { text: string; lang: SayLang; label?: string }) {
  const { t } = useI18n()
  const voice = useVoice(lang)
  const [on, setOn] = useState(false)
  if (!voice) return null
  const say = () => {
    const s = synth(); if (!s) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = TAG[lang]; u.voice = voice; u.rate = 0.8
    u.onend = u.onerror = () => setOn(false)
    setOn(true); s.speak(u)
  }
  return (
    <button type="button" className={`say-btn${on ? ' is-on' : ''}`} onClick={say} aria-label={label ?? t('say.listen', { w: text })} title={t('say.listen', { w: text })}>
      <Icon name="volume" size={16} />
    </button>
  )
}
