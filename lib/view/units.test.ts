import { describe, it, expect } from 'vitest'
import { resolveUnits } from '@/lib/view/units'

describe('resolveUnits', () => {
  it('uses the system named in the URL', () => {
    expect(resolveUnits('imperial', null)).toEqual({ system: 'imperial', restore: false })
    expect(resolveUnits('metric', null)).toEqual({ system: 'metric', restore: false })
  })

  // The defect this function exists to stop: metric used to be written as
  // "no parameter", which the restore step read as "never chosen". It then
  // put the saved imperial back, so a click on Metric never held.
  it('lets the URL beat the saved choice, both ways', () => {
    expect(resolveUnits('metric', 'imperial')).toEqual({ system: 'metric', restore: false })
    expect(resolveUnits('imperial', 'metric')).toEqual({ system: 'imperial', restore: false })
  })

  it('applies the saved choice only when the URL names none', () => {
    expect(resolveUnits(null, 'imperial')).toEqual({ system: 'imperial', restore: true })
    expect(resolveUnits(null, 'metric')).toEqual({ system: 'metric', restore: true })
  })

  it('shows metric when nothing is known', () => {
    expect(resolveUnits(null, null)).toEqual({ system: 'metric', restore: false })
  })

  it('ignores a value it does not know', () => {
    expect(resolveUnits('martian', null)).toEqual({ system: 'metric', restore: false })
    expect(resolveUnits(null, 'martian')).toEqual({ system: 'metric', restore: false })
    expect(resolveUnits('', null)).toEqual({ system: 'metric', restore: false })
  })
})
