import { BLOCK_TYPE_LABEL } from '../lib/constants'
import type { Block, LangCode } from '@shared/contract'
import { BlockField, isNonText } from './BlockEditor'
import { Button } from './ui'
import { findVoiceForLang, useSpeechPlayer, useVoices } from '../lib/voice'

/** Original (read-only) next to translation (editable). Stacks on phones. */
export function SideBySide({
  original,
  translated,
  onEdit,
  originalLabel,
  translatedLabel,
  sourceLang,
  targetLang,
  preview = false,
  isUnlocked = true,
  onPay,
  payLoading = false,
  payError = null,
  onRetryPay,
  priceEtb = 100,
}: {
  original: Block[]
  translated: Block[]
  onEdit: (index: number, text: string) => void
  originalLabel: string
  translatedLabel: string
  sourceLang?: LangCode
  targetLang?: LangCode
  /** Show the red PREVIEW watermark (document not issued yet). */
  preview?: boolean
  isUnlocked?: boolean
  onPay?: () => void
  payLoading?: boolean
  payError?: string | null
  onRetryPay?: () => void
  priceEtb?: number
}) {
  const { voices } = useVoices()
  const { currentId, speaking, speak, stop } = useSpeechPlayer()

  const voiceOrig = findVoiceForLang(voices, sourceLang)
  const voiceTrans = findVoiceForLang(voices, targetLang)
  const hasVoiceOrig = Boolean(voiceOrig)
  const hasVoiceTrans = Boolean(voiceTrans)

  const visibleOriginal = isUnlocked ? original : original.slice(0, 3)
  const visibleTranslated = isUnlocked ? translated : translated.slice(0, 3)
  const remainingCount = original.length > 3 ? original.length - 3 : 0

  const handleReadAllOrig = () => {
    if (currentId === 'orig-all') {
      stop()
      return
    }
    const fullText = visibleOriginal
      .filter((b) => !isNonText(b))
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join('. ')
    speak('orig-all', fullText, voiceOrig, sourceLang)
  }

  const handleReadAllTrans = () => {
    if (currentId === 'trans-all') {
      stop()
      return
    }
    const fullText = visibleTranslated
      .filter((b) => !isNonText(b))
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join('. ')
    speak('trans-all', fullText, voiceTrans, targetLang)
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 ${preview ? 'preview-watermark' : ''}`}>
      {/* Global stop button if audio is playing */}
      {speaking && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <span className="font-medium">Reading aloud…</span>
          <Button variant="secondary" onClick={stop} className="!py-1 !px-3 text-xs">
            Stop
          </Button>
        </div>
      )}

      {/* Desktop Column Headers */}
      <div className="mb-3 hidden grid-cols-2 gap-4 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span>Original — {originalLabel}</span>
          <div className="flex items-center gap-1.5 font-normal normal-case">
            {hasVoiceOrig ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReadAllOrig}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {currentId === 'orig-all' ? '⏹ Stop' : '🔊 Listen'}
                </button>
              </div>
            ) : (
              <span className="text-[11px] italic text-slate-400">
                Voice not available for this language on this device
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span>Translation — {translatedLabel} (editable)</span>
          <div className="flex items-center gap-1.5 font-normal normal-case">
            {hasVoiceTrans ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReadAllTrans}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {currentId === 'trans-all' ? '⏹ Stop' : '🔊 Listen'}
                </button>
              </div>
            ) : (
              <span className="text-[11px] italic text-slate-400">
                Voice not available for this language on this device
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Top Read-All / Voice availability bar */}
      <div className="mb-3 space-y-2 border-b border-slate-100 pb-3 md:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700">Original ({originalLabel}):</span>
          {hasVoiceOrig ? (
            <button
              type="button"
              onClick={handleReadAllOrig}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {currentId === 'orig-all' ? '⏹ Stop' : '🔊 Listen (read all)'}
            </button>
          ) : (
            <span className="text-[11px] italic text-slate-500">
              Voice not available for this language on this device
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700">Translation ({translatedLabel}):</span>
          {hasVoiceTrans ? (
            <button
              type="button"
              onClick={handleReadAllTrans}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {currentId === 'trans-all' ? '⏹ Stop' : '🔊 Listen (read all)'}
            </button>
          ) : (
            <span className="text-[11px] italic text-slate-500">
              Voice not available for this language on this device
            </span>
          )}
        </div>
      </div>

      {/* Blocks List */}
      <ol className="space-y-4">
        {visibleOriginal.map((o, i) => {
          const t = visibleTranslated[i]
          const isOrigSpeaking = currentId === `orig-${o.id}`
          const isTransSpeaking = t && currentId === `trans-${t.id}`

          return (
            <li
              key={o.id}
              className="grid gap-2 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 md:grid-cols-2 md:gap-4 md:border-t-0 md:pt-0"
            >
              {/* Original Block */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">
                    <span className="md:hidden">{i + 1}. Original — {originalLabel} · </span>
                    <span className="hidden md:inline">{i + 1}. </span>
                    {BLOCK_TYPE_LABEL[o.type]}
                  </p>
                  {hasVoiceOrig && !isNonText(o) && o.text.trim() && (
                    <button
                      type="button"
                      onClick={() =>
                        isOrigSpeaking ? stop() : speak(`orig-${o.id}`, o.text, voiceOrig, sourceLang)
                      }
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold transition ${
                        isOrigSpeaking
                          ? 'border border-red-300 bg-red-50 text-red-700'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isOrigSpeaking ? '⏹ Stop' : '🔊 Listen'}
                    </button>
                  )}
                </div>
                <BlockField block={o} readOnly label={`Original block ${i + 1}`} />
              </div>

              {/* Translated Block */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">
                    <span className="md:hidden">Translation — {translatedLabel}</span>
                    <span className="hidden md:inline">{i + 1}. {BLOCK_TYPE_LABEL[t?.type ?? o.type]}</span>
                  </p>
                  {t && hasVoiceTrans && !isNonText(t) && t.text.trim() && (
                    <button
                      type="button"
                      onClick={() =>
                        isTransSpeaking ? stop() : speak(`trans-${t.id}`, t.text, voiceTrans, targetLang)
                      }
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold transition ${
                        isTransSpeaking
                          ? 'border border-red-300 bg-red-50 text-red-700'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isTransSpeaking ? '⏹ Stop' : '🔊 Listen'}
                    </button>
                  )}
                </div>
                {t && (
                  <BlockField
                    block={t}
                    onChange={(text) => onEdit(i, text)}
                    label={`Translated block ${i + 1}`}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Paywall: Locked placeholders for remaining blocks */}
      {!isUnlocked && remainingCount > 0 && (
        <div className="mt-5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-5 text-center sm:p-6">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg text-amber-700">
            🔒
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Remaining {remainingCount} blocks unlock after payment
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {priceEtb} ETB <span className="font-normal text-slate-500">(demo price)</span>
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2">
            <Button
              variant="primary"
              loading={payLoading}
              onClick={onPay}
              className="w-full sm:w-auto"
            >
              Pay with Chapa (test mode)
            </Button>
            {payError && (
              <div className="mt-2 text-sm text-red-600">
                <span>{payError}</span>
                {onRetryPay && (
                  <button
                    type="button"
                    onClick={onRetryPay}
                    className="ml-2 font-semibold underline hover:text-red-800"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
