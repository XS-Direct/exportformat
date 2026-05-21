import { describe, it, expect } from 'vitest'
import { parse } from '../src/shared/parser'
import { evaluate, createContext } from '../src/shared/evaluator'

function evalString(src: string, fields: Record<string, string> = {}, rowIndex = 0): string {
  const { tree } = parse(src)
  const ctx = createContext(Object.entries(fields), rowIndex)
  return evaluate(tree, ctx)
}

describe('evaluator', () => {
  it('resolves bare field ids', () => {
    expect(evalString('{471: id}', { '471': 'A0001' })).toBe('A0001')
  })

  it('resolves missing fields to an empty string (matches Pace runtime)', () => {
    expect(evalString('{999: missing}')).toBe('')
  })

  it('joins concat args verbatim', () => {
    expect(evalString('$concat[a,b,c]')).toBe('abc')
  })

  it('handles $if truthy path', () => {
    expect(evalString('$if[1, yes, no]')).toBe('yes')
    expect(evalString('$if[0, yes, no]')).toBe('no')
    expect(evalString('$if[, yes, no]')).toBe('no')
  })

  it('handles $ifelse truthy path', () => {
    expect(evalString('$ifelse[hi, yes, no]')).toBe('yes')
    expect(evalString('$ifelse[, yes, no]')).toBe('no')
  })

  it('stores and retrieves $var', () => {
    expect(evalString('$storevar[x, hi]$var[x]')).toBe('hi')
  })

  it('formats $date from a literal source', () => {
    expect(evalString('$date[Y-m-d, 2024-03-04]')).toBe('2024-03-04')
  })

  it('uppercases via $strtoupper', () => {
    expect(evalString('$strtoupper[hello]')).toBe('HELLO')
  })

  it('left-pads via $pad', () => {
    expect(evalString('$pad[7, 4, 0, left]')).toBe('0007')
  })

  it('counts rows via $count', () => {
    expect(evalString('$count', {}, 4)).toBe('5')
  })

  it('handles nested $if with $strlen guard', () => {
    const src = '$if[$strlen[{99-7: Project}], WV26063, none]'
    expect(evalString(src, { '99-7': '204' })).toBe('WV26063')
    expect(evalString(src, {})).toBe('none')
  })
})
