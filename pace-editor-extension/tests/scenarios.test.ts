import { describe, it, expect } from 'vitest'
import { runSimulation } from '../src/shared/simulator'
import { alzheimerNlFixtures } from '../src/shared/fixtures/alzheimer-nl'
import { aidsfondsFixtures } from '../src/shared/fixtures/aidsfonds'

// The repeating-code templates below are simplified stand-ins. Replace
// each `repeatingCode` with the byte-identical Pace template once the
// real ones are pasted into the side panel and exported.

describe('Alzheimer NL — project 204 rerouting', () => {
  // Pace templates emulate `==` by replacing the literal target with the empty
  // string: if the project equals "204", $replace returns "" and $strlen is 0
  // — falsy. Otherwise the original project survives the replace and the
  // truthy branch keeps the original value.
  const repeatingCode =
    '{471: id}\t{34-445: Person: Sex}\t{12-100: Org}\t' +
    '$if[$strlen[$replace[204, ,{99-7: Project}]], {99-7: Project}, WV26063]' +
    '\t{50-1: Person: Firstname}\t{50-2: Person: Lastname}'

  it('routes project 204 to WV26063 and keeps other projects intact', () => {
    const out = runSimulation({
      codeBefore: '',
      codeAfter: '',
      repeatingCode,
      bundle: alzheimerNlFixtures,
    })
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0].columns[3]).toBe('WV26063')
    expect(out.rows[1].columns[3]).toBe('301')
  })
})

describe('Aidsfonds — IP-pilot column', () => {
  const repeatingCode =
    '{471: id}\t{34-445: Person: Sex}\t{12-100: Org}\t' +
    '$ifelse[{60-12: Pilot}, {60-12: Pilot}, standard]'

  it('outputs the pilot flag for both standard and ip-pilot donors', () => {
    const out = runSimulation({
      codeBefore: '',
      codeAfter: '',
      repeatingCode,
      bundle: aidsfondsFixtures,
    })
    expect(out.rows[0].columns).toEqual(['AF001', 'V', 'Aidsfonds', 'standard'])
    expect(out.rows[1].columns).toEqual(['AF002', 'M', 'Aidsfonds', 'ip-pilot'])
  })
})
