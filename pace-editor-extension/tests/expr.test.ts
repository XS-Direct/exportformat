import { describe, it, expect } from 'vitest'
import { evaluateCondition } from '../src/shared/expr'

describe('evaluateCondition', () => {
  it('treats empty input as false', () => {
    expect(evaluateCondition('')).toBe(false)
    expect(evaluateCondition('   ')).toBe(false)
  })

  it('handles numeric equality and inequality', () => {
    expect(evaluateCondition('205 == 205')).toBe(true)
    expect(evaluateCondition('205 == 206')).toBe(false)
    expect(evaluateCondition('205 != 206')).toBe(true)
  })

  it('handles >, <, >=, <=', () => {
    expect(evaluateCondition('20260105 > 20260104')).toBe(true)
    expect(evaluateCondition('20260104 > 20260104')).toBe(false)
    expect(evaluateCondition('20260104 >= 20260104')).toBe(true)
    expect(evaluateCondition('20260104 < 20260105')).toBe(true)
    expect(evaluateCondition('20260105 <= 20260104')).toBe(false)
  })

  it('falls back to string comparison for non-numeric operands', () => {
    expect(evaluateCondition('door-to-door == door-to-door')).toBe(true)
    expect(evaluateCondition("'door-to-door' == 'door-to-door'")).toBe(true)
    expect(evaluateCondition('valid == invalid')).toBe(false)
  })

  it('respects && and || precedence (&& binds tighter)', () => {
    expect(evaluateCondition('1 == 1 || 1 == 2 && 1 == 3')).toBe(true)
    expect(evaluateCondition('1 == 2 || 1 == 1 && 1 == 1')).toBe(true)
    expect(evaluateCondition('1 == 2 || 1 == 1 && 1 == 3')).toBe(false)
  })

  it('left-to-right chained ||', () => {
    const src = '205 == 207 || 205 == 206 || 205 == 205'
    expect(evaluateCondition(src)).toBe(true)
  })

  it('treats a single bare literal as truthiness check', () => {
    expect(evaluateCondition('something')).toBe(true)
    expect(evaluateCondition('')).toBe(false)
    expect(evaluateCondition('0')).toBe(false)
  })
})
