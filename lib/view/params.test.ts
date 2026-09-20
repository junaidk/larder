import { describe, it, expect } from 'vitest'
import { readViewParams } from '@/lib/view/params'

describe('readViewParams', () => {
  it('gives the default view for no parameters', () => {
    expect(readViewParams({}, 8)).toEqual({ system: 'metric', factor: 1 })
  })

  it('reads the imperial system', () => {
    expect(readViewParams({ units: 'imperial' }, 8).system).toBe('imperial')
  })

  it('ignores an unknown system', () => {
    expect(readViewParams({ units: 'martian' }, 8).system).toBe('metric')
  })

  it('reads a scale factor', () => {
    expect(readViewParams({ scale: '0.5' }, 8).factor).toBe(0.5)
  })

  it('reads a fraction factor', () => {
    expect(readViewParams({ scale: '1/2' }, 8).factor).toBe(0.5)
  })

  it('ignores a factor that is not valid', () => {
    expect(readViewParams({ scale: 'abc' }, 8).factor).toBe(1)
    expect(readViewParams({ scale: '0' }, 8).factor).toBe(1)
  })

  it('reads a servings target and turns it into a factor', () => {
    expect(readViewParams({ serves: '4' }, 8).factor).toBe(0.5)
  })

  it('ignores a servings target when the recipe has no serves field', () => {
    expect(readViewParams({ serves: '4' }, null).factor).toBe(1)
  })

  it('lets an explicit scale win over a servings target', () => {
    expect(readViewParams({ scale: '2', serves: '4' }, 8).factor).toBe(2)
  })

  it('reads the first value of a repeated parameter', () => {
    expect(readViewParams({ units: ['imperial', 'metric'] }, 8).system).toBe('imperial')
  })
})
