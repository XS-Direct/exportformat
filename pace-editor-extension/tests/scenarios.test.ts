import { describe, it, expect } from 'vitest'
import { runSimulation } from '../src/shared/simulator'
import {
  aidsfondsFixtures,
  AIDSFONDS_REPEATING_CODE,
} from '../src/shared/fixtures/aidsfonds'
import { alzheimerNlFixtures } from '../src/shared/fixtures/alzheimer-nl'

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

describe('Alzheimer NL — project 204 rerouting', () => {
  // Pace's `==` style condition: ifelse over the project id selects the
  // remapped product code.
  const repeatingCode =
    '{471: id}&#9;{34-445: Person: Sex}&#9;{12-100: Org}&#9;' +
    '$ifelse[{99-7: Project} == 204][WV26063][{99-7: Project}]' +
    '&#9;{50-1: Person: Firstname}&#9;{50-2: Person: Lastname}'

  it('routes project 204 to WV26063 and keeps other projects intact', () => {
    const out = runSimulation({
      codeBefore: '',
      codeAfter: '',
      repeatingCode,
      bundle: alzheimerNlFixtures,
    })
    expect(out.rows[0].columns[3]).toBe('WV26063')
    expect(out.rows[1].columns[3]).toBe('301')
  })
})
