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

  it('handles an empty right-hand operand (Pace "not empty" check)', () => {
    // After template substitution, `{Prefix} !=` collapses to `value !=`
    // when Prefix has a value, and to ` !=` when it does not. The "not
    // empty" idiom needs both forms to behave correctly.
    expect(evaluateCondition('von !=')).toBe(true)
    expect(evaluateCondition(' !=')).toBe(false)
    expect(evaluateCondition('von ==')).toBe(false)
  })

  it('does not eat the next && when the right operand is empty', () => {
    // Regression: parseAtom used to consume the && token, so the right
    // side of the && silently evaluated to true. With the peek-only fix
    // the second clause is now reached.
    expect(evaluateCondition('von != && Y == 1')).toBe(false)
    expect(evaluateCondition('von != && Y == Y')).toBe(true)
    expect(evaluateCondition(' != && anything')).toBe(false)
  })
})
