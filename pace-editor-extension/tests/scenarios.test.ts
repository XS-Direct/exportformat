import { describe, it, expect } from 'vitest'
import { parse } from '../src/shared/parser'
import { serialize } from '../src/shared/serializer'
import { evaluate, createContext } from '../src/shared/evaluator'
import { runSimulation } from '../src/shared/simulator'
import {
  aidsfondsFixtures,
  AIDSFONDS_REPEATING_CODE,
} from '../src/shared/fixtures/aidsfonds'
import {
  alzheimerNlFixtures,
  ALZHEIMER_NL_REPEATING_CODE,
} from '../src/shared/fixtures/alzheimer-nl'

function evalRow(template: string, fields: Record<string, string>): string {
  const { tree } = parse(template)
  return evaluate(tree, createContext(Object.entries(fields), 0))
}

describe('Aidsfonds — production routing matrix', () => {
  const out = runSimulation({
    codeBefore: '',
    codeAfter: '',
    repeatingCode: AIDSFONDS_REPEATING_CODE,
    bundle: aidsfondsFixtures,
  })

  it('produces a row per scenario with the expected leading columns', () => {
    expect(out.rows).toHaveLength(aidsfondsFixtures.scenarios.length)
    for (const row of out.rows) {
      for (const diff of row.diff) {
        if (diff.expected === null || diff.expected === undefined) continue
        expect(diff.actual, `${row.scenarioId} col ${diff.index}`).toBe(diff.expected)
      }
    }
  })
})

describe('Alzheimer NL — campaign-proposition routing', () => {
  function firstColumn(fields: Record<string, string>): string {
    const raw = evalRow(ALZHEIMER_NL_REPEATING_CODE, fields)
    // First column of the CSV — between the opening `"` and the next `";`.
    const match = raw.match(/^"([^"]*)"/)
    return match ? match[1] : ''
  }

  const cases: Array<[string, Record<string, string>, string]> = [
    ['project 204', alzheimerNlFixtures.scenarios[0].record.fields, 'WV26063'],
    ['method event', alzheimerNlFixtures.scenarios[1].record.fields, 'WV25209'],
    ['domain genz', alzheimerNlFixtures.scenarios[2].record.fields, 'WV23034'],
    ['date > 2026-03-01', alzheimerNlFixtures.scenarios[3].record.fields, 'WV26016'],
    ['default', alzheimerNlFixtures.scenarios[4].record.fields, 'WV20136'],
  ]

  for (const [label, fields, expected] of cases) {
    it(`${label} → ${expected}`, () => {
      expect(firstColumn(fields)).toBe(expected)
    })
  }

  it('non-binary sex resolves the sex column to "X"', () => {
    const raw = evalRow(ALZHEIMER_NL_REPEATING_CODE, {
      '22-326': '204',
      '34-445': 'non-binary',
    })
    // The sex column is the third quoted value in the CSV row.
    const columns = raw.match(/"([^"]*)"/g)
    expect(columns).toBeTruthy()
    expect(columns![2]).toBe('"X"')
  })

  it('round-trips the full template byte-identical', () => {
    const { tree, diagnostics } = parse(ALZHEIMER_NL_REPEATING_CODE)
    expect(diagnostics.hasErrors).toBe(false)
    expect(serialize(tree)).toBe(ALZHEIMER_NL_REPEATING_CODE)
  })
})
