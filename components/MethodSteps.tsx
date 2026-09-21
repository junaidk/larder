'use client'

import { useState, type ReactNode } from 'react'

/**
 * The method. A click strikes a step through, to help you keep your place.
 * The mark lives in this page only. It never reaches the recipe file.
 */
export function MethodSteps({ lead, steps }: { lead: ReactNode; steps: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({})

  function toggle(i: number) {
    setDone((previous) => ({ ...previous, [i]: !previous[i] }))
  }

  return (
    <div>
      {lead && <div className="mb-4">{lead}</div>}

      <ol className="space-y-4">
        {steps.map((step, i) => {
          const struck = done[i]
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={struck}
                className={`flex w-full gap-4 rounded px-1 py-1 text-left hover:bg-stone-100 ${
                  struck ? 'opacity-40' : ''
                }`}
              >
                <span className="w-8 shrink-0 pt-0.5 text-right font-sans text-2xl leading-none font-light tabular-nums text-stone-300">
                  {i + 1}
                </span>
                <span
                  className={`font-serif text-[1.05rem] leading-relaxed whitespace-pre-wrap text-stone-800 ${
                    struck ? 'line-through' : ''
                  }`}
                >
                  {step}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
