'use client'

import { parseIngredientLine } from '@/lib/recipe/ingredient'
import { isMethodHeading } from '@/lib/view/editor'
import { Markdown } from '@/components/Markdown'

/**
 * How the recipe will read, drawn from what the form holds right now.
 *
 * This shows the amounts exactly as they are written, with no scaling and
 * no change of units. Those belong to the recipe page, where the reader
 * chooses them. Here the writer needs to see what the file will say.
 */
export function EditorPreview({
  title,
  ingredientLines,
  methodItems,
  notes,
}: {
  title: string
  ingredientLines: string[]
  methodItems: string[]
  notes: string
}) {
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl leading-tight font-semibold tracking-tight text-ink">
        {title.trim() || 'Untitled'}
      </h2>

      {ingredientLines.some((l) => l.trim() !== '') && (
        <section>
          <h3 className="mb-3 font-sans text-xs font-medium tracking-widest text-ink-faint uppercase">
            Ingredients
          </h3>
          <ul className="space-y-1">
            {ingredientLines.map((line, i) => {
              const text = line.trim()
              if (text === '') return null

              if (isMethodHeading(text)) {
                return (
                  <li key={i} className="pt-3 pl-8 font-sans text-xs font-medium tracking-wide text-ink-muted uppercase">
                    {text.replace(/^\s*###\s+/, '')}
                  </li>
                )
              }

              const parsed = parseIngredientLine(`- ${text}`)
              return (
                <li key={i} className="flex gap-4">
                  <span className="w-8 shrink-0 text-right leading-7">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-dim align-middle" />
                  </span>
                  <span className="font-serif leading-7 text-ink">
                    {parsed.quantity && (
                      <span className="font-sans text-sm font-medium tabular-nums text-ink">
                        {parsed.quantity.raw}{' '}
                      </span>
                    )}
                    {parsed.unitRaw && (
                      <span className="font-sans text-sm text-ink-faint">{parsed.unitRaw} </span>
                    )}
                    {parsed.item ?? text}
                    {parsed.prep && <span className="text-ink-muted italic">, {parsed.prep}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {methodItems.some((s) => s.trim() !== '') && (
        <section>
          <h3 className="mb-3 font-sans text-xs font-medium tracking-widest text-ink-faint uppercase">
            Method
          </h3>
          <ol className="space-y-3">
            {numberItems(methodItems).map((item, i) => (
              <li key={i}>
                {item.kind === 'heading' ? (
                  <h4 className="mt-5 pl-12 font-sans text-xs font-medium tracking-wide text-ink-muted uppercase first:mt-0">
                    {item.text}
                  </h4>
                ) : (
                  <div className="flex gap-4">
                    <span className="w-8 shrink-0 pt-0.5 text-right font-sans text-xl leading-none font-light tabular-nums text-ink-dim">
                      {item.number}
                    </span>
                    <span className="font-serif leading-relaxed whitespace-pre-wrap text-ink">
                      {item.text}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {notes.trim() !== '' && (
        <section>
          <h3 className="mb-3 font-sans text-xs font-medium tracking-widest text-ink-faint uppercase">
            Notes
          </h3>
          <Markdown>{notes}</Markdown>
        </section>
      )}
    </div>
  )
}

/** Give each step its number. The count starts again below every heading. */
function numberItems(
  items: string[],
): ({ kind: 'heading'; text: string } | { kind: 'step'; text: string; number: number })[] {
  let number = 0
  return items
    .filter((item) => item.trim() !== '')
    .map((item) => {
      if (isMethodHeading(item)) {
        number = 0
        return { kind: 'heading' as const, text: item.replace(/^\s*###\s+/, '').trim() }
      }
      number += 1
      return { kind: 'step' as const, text: item, number }
    })
}
