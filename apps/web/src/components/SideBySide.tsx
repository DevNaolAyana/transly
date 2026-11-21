import { BLOCK_TYPE_LABEL } from '../lib/constants'
import type { Block } from '@shared/contract'
import { BlockField } from './BlockEditor'

/** Original (read-only) next to translation (editable). Stacks on phones. */
export function SideBySide({
  original,
  translated,
  onEdit,
  originalLabel,
  translatedLabel,
  preview = false,
}: {
  original: Block[]
  translated: Block[]
  onEdit: (index: number, text: string) => void
  originalLabel: string
  translatedLabel: string
  /** Show the red PREVIEW watermark (document not issued yet). */
  preview?: boolean
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 ${preview ? 'preview-watermark' : ''}`}>
      <div className="mb-2 hidden grid-cols-2 gap-4 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
        <span>Original — {originalLabel}</span>
        <span>Translation — {translatedLabel} (editable)</span>
      </div>
      <ol className="space-y-4">
        {original.map((o, i) => (
          <li
            key={o.id}
            // on phones the pairs stack, so a rule and the block number show where one pair ends
            className="grid gap-2 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 md:grid-cols-2 md:gap-4 md:border-t-0 md:pt-0"
          >
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 md:hidden">{i + 1}. Original — {originalLabel} · {BLOCK_TYPE_LABEL[o.type]}</p>
              <BlockField block={o} readOnly label={`Original block ${i + 1}`} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 md:hidden">Translation — {translatedLabel}</p>
              {translated[i] && (
                <BlockField block={translated[i]} onChange={(t) => onEdit(i, t)} label={`Translated block ${i + 1}`} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
