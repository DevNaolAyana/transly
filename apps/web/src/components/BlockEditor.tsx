import { BLOCK_TYPE_LABEL, NON_TEXT_PLACEHOLDER, NON_TEXT_TYPES } from '../lib/constants'
import type { Block } from '@shared/contract'

export const UNCLEAR = '[unclear]'
export const hasUnclear = (t: string) => t.toLowerCase().includes(UNCLEAR)

/** Renders text with every "[unclear]" marked. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[unclear\])/gi)
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === UNCLEAR ? (
          <mark key={i} className="rounded bg-amber-300 px-1 font-semibold text-amber-950">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function isNonText(b: Block) {
  return NON_TEXT_TYPES.includes(b.type) && b.type !== 'handwriting'
}

const textCls =
  'block w-full min-h-11 resize-y rounded-lg border px-3 py-2 text-base leading-relaxed focus:outline-none focus:ring-2 [field-sizing:content]'

/** One editable (or read-only) block. */
export function BlockField({
  block,
  onChange,
  readOnly,
  label,
}: {
  block: Block
  onChange?: (text: string) => void
  readOnly?: boolean
  label?: string
}) {
  if (isNonText(block)) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
        {NON_TEXT_PLACEHOLDER[block.type]}
      </div>
    )
  }
  const unclear = hasUnclear(block.text)
  const tone = unclear
    ? 'border-amber-500 bg-amber-50 focus:ring-amber-400'
    : readOnly
      ? 'border-slate-200 bg-slate-50/70 text-slate-700 focus:ring-slate-300'
      : 'border-slate-300 bg-white/70 focus:ring-brand-600/40'
  return (
    <div>
      <textarea
        aria-label={label ?? BLOCK_TYPE_LABEL[block.type]}
        className={`${textCls} ${tone} ${block.type === 'heading' ? 'font-bold' : ''}`}
        value={block.text}
        readOnly={readOnly}
        rows={2}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {unclear && (
        <p className="mt-1 text-sm text-amber-900">
          <span className="font-semibold">Needs your attention: </span>
          <Highlighted text={block.text} />
        </p>
      )}
    </div>
  )
}
