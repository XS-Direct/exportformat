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

  it('routes {var:NAME} refs to the variable map', () => {
    const { tree } = parse('$var[count][42]{var:count}')
    const ctx = createContext([])
    expect(evaluate(tree, ctx)).toBe('42')
  })

  it('evaluates $if with a comparison condition', () => {
    expect(evalString('$if[{x} == 1][yes]', { x: '1' })).toBe('yes')
    expect(evalString('$if[{x} == 1][yes]', { x: '0' })).toBe('')
  })

  it('evaluates $ifelse with then/else branches', () => {
    expect(evalString('$ifelse[{x} == 1][yes][no]', { x: '1' })).toBe('yes')
    expect(evalString('$ifelse[{x} == 1][yes][no]', { x: '0' })).toBe('no')
  })

  it('honours `||` and `&&` in conditions', () => {
    const src = '$ifelse[{x} == 205 || {x} == 206 || {x} == 207][match][miss]'
    expect(evalString(src, { x: '206' })).toBe('match')
    expect(evalString(src, { x: '300' })).toBe('miss')

    const both = '$if[{x} == valid && {y} == 1][hit]'
    expect(evalString(both, { x: 'valid', y: '1' })).toBe('hit')
    expect(evalString(both, { x: 'valid', y: '0' })).toBe('')
  })

  it('compares single-quoted string operands', () => {
    const src = `$if['{m: Method override}' == 'door-to-door'][hit]`
    expect(evalString(src, { m: 'door-to-door' })).toBe('hit')
    expect(evalString(src, { m: 'event' })).toBe('')
  })

  it('does numeric > comparison on date-formatted operands', () => {
    const src = '$if[$date[{d}][%Y%m%d] > 20260104][late]'
    expect(evalString(src, { d: '2026-03-15' })).toBe('late')
    expect(evalString(src, { d: '2025-12-01' })).toBe('')
  })

  it('stores and retrieves $var via two-bracket syntax', () => {
    expect(evalString('$var[x][hi]$var[x]')).toBe('hi')
  })

  it('substr respects negative start and comma-separated start/length', () => {
    expect(evalString('$substr[1234ABCD][0, 4]')).toBe('1234')
    expect(evalString('$substr[1234ABCD][-2]')).toBe('CD')
  })

  it('replaces commas with dots in amounts', () => {
    expect(evalString('$replace[,][.][{478}]', { '478': '15,50' })).toBe('15.50')
  })

  it('formats dates with %d-%m-%Y', () => {
    expect(evalString('$date[2024-03-04][%d-%m-%Y]')).toBe('04-03-2024')
  })

  it('counts rows via $count', () => {
    expect(evalString('$count', {}, 4)).toBe('5')
  })

  it('uppercases via $upper (alias of $strtoupper)', () => {
    expect(evalString('$upper[utrecht]')).toBe('UTRECHT')
    expect(evalString('$strtoupper[utrecht]')).toBe('UTRECHT')
  })

  it('capitalises the first letter via $ucfirst', () => {
    expect(evalString('$ucfirst[female]')).toBe('Female')
    expect(evalString('$ucfirst[]')).toBe('')
  })

  it('renders $strtotime[first day of next month] as an ISO date', () => {
    const out = evalString('$strtotime[first day of next month]')
    expect(out).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('feeds $strtotime into $date for relative-date columns', () => {
    const formatted = evalString('$date[$strtotime[first day of next month]][%Y-%m-%d]')
    expect(formatted).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('$query returns empty (real Pace executes SQL, simulator cannot)', () => {
    expect(evalString(`$query[SELECT 1 FROM t WHERE id = '{x}']`, { x: 'A' })).toBe('')
  })

  it('$storevar reads with one arg, writes with two', () => {
    expect(evalString('$storevar[v][hello]$storevar[v]')).toBe('hello')
  })
})
