import { useCallback, useEffect, useRef, useState } from 'react'
import type { LangCode } from '@shared/contract'

/**
 * Voice matching helper according to Transly contract:
 * Language codes: om -> 'om', am -> 'am-ET' (or 'am'), en -> 'en-US'
 */
export function findVoiceForLang(
  voices: SpeechSynthesisVoice[],
  lang?: LangCode | null,
): SpeechSynthesisVoice | undefined {
  if (!lang || !Array.isArray(voices) || voices.length === 0) return undefined
  const l = lang.toLowerCase()
  if (l === 'om') {
    return voices.find((v) => v.lang.toLowerCase().startsWith('om'))
  }
  if (l === 'am') {
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith('am-et')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('am'))
    )
  }
  if (l === 'en') {
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    )
  }
  return undefined
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setLoaded(true)
      return
    }

    const update = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) {
        setVoices(v)
        setLoaded(true)
      }
    }

    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)

    const timer = setTimeout(() => {
      update()
      setLoaded(true)
    }, 500)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update)
      clearTimeout(timer)
    }
  }, [])

  return { voices, loaded }
}

export function useSpeechPlayer() {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    activeUtterance.current = null
    setCurrentId(null)
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (id: string, text: string, voice?: SpeechSynthesisVoice, langCode?: LangCode) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()

      const trimmed = text.trim()
      if (!trimmed) return

      const u = new SpeechSynthesisUtterance(trimmed)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      } else if (langCode) {
        u.lang = langCode === 'om' ? 'om' : langCode === 'am' ? 'am-ET' : 'en-US'
      }

      setCurrentId(id)
      setSpeaking(true)

      u.onstart = () => {
        setCurrentId(id)
        setSpeaking(true)
      }
      u.onend = () => {
        setCurrentId(null)
        setSpeaking(false)
        activeUtterance.current = null
      }
      u.onerror = () => {
        setCurrentId(null)
        setSpeaking(false)
        activeUtterance.current = null
      }

      activeUtterance.current = u
      window.speechSynthesis.speak(u)
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return { currentId, speaking, speak, stop }
}
