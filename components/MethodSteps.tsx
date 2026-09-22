'use client'

import { useState, type ReactNode } from 'react'
import type { MethodItem } from '@/lib/view/method'

/**
 * The method. A click strikes a step through, to help you keep your place.
 * The mark lives in this page only. It never reaches the recipe file.
 *
 * A section heading breaks the method into parts. The numbers start again
 * below each heading, so every section reads from 1.
 */
export function MethodSteps({ lead, items }: { lead: ReactNode; items: MethodItem[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({})

  function toggle(i: number) {
    setDone((previous) => ({ ...previous, [i]: !previous[i] }))
  }

  return (
    <div>
      {lead && <div className="mb-4">{lead}</div>}

      <ol className="space-y-4">
        {items.map((item, i) => {
          if (item.kind === 'heading') {
            return (
              <li key={i}>
                {/* The left padding matches the numeral gutter, so a heading
                    starts where the step text starts. */}
                <h3 className="mt-8 pl-12 font-sans text-xs font-medium tracking-wide text-ink-muted uppercase first:mt-0">
                  {item.text}
                </h3>
              </li>
            )
          }

          const struck = done[i]
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={struck}
                className={`flex w-full gap-4 rounded px-1 py-1 text-left hover:bg-raised ${
                  struck ? 'opacity-40' : ''
                }`}
              >
                <span className="w-8 shrink-0 pt-0.5 text-right font-sans text-2xl leading-none font-light tabular-nums text-ink-dim">
                  {item.number}
                </span>
                <span
                  className={`font-serif text-[1.05rem] leading-relaxed whitespace-pre-wrap text-ink ${
                    struck ? 'line-through' : ''
                  }`}
                >
                  {item.text}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
