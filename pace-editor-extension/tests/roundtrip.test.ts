import { describe, it, expect } from 'vitest'
import { parse } from '../src/shared/parser'
import { serialize } from '../src/shared/serializer'
import { AIDSFONDS_REPEATING_CODE } from '../src/shared/fixtures/aidsfonds'
import {
  ALZHEIMER_NL_CODE_BEFORE,
  ALZHEIMER_NL_REPEATING_CODE,
} from '../src/shared/fixtures/alzheimer-nl'
import {
  AMNESTY_CODE_BEFORE,
  AMNESTY_REPEATING_CODE,
} from '../src/shared/fixtures/amnesty'
import {
  AMREF_CODE_BEFORE,
  AMREF_REPEATING_CODE,
} from '../src/shared/fixtures/amref'

const corpus: string[] = [
  '',
  'plain text',
  '{471: id}',
  'id={471: id}&#9;{34-445: Person: Sex}',
  '$count',
  '$tab[]',
  '$if[{471: id} == 1][yes]',
  '$ifelse[{471: id} == 1][yes][no]',
  '$replace[,][.][{478: Amount}]',
  '$var[count][{var:count} + 1]',
  '$substr[{34-51-710: Person: Address: Postal code}][0, 4]',
  '$date[{476: Date}][%d-%m-%Y]',
  // Single-quoted condition operands; method-override branch from the
  // real Aidsfonds template.
  `$if['{803: Method override}' == 'door-to-door'][23580]`,
  // Real-world combination — nested $ifelse over project ids and a
  // method-override sub-branch.
  `$ifelse[{22-326: Project: id} == 205 || {22-326: Project: id} == 206]` +
    `[$if['{803: Method override}' == 'event'][22698]][]`,
  // The whole Aidsfonds template — this is the canonical round-trip
  // bar that protects the parser/serializer against regressions.
  AIDSFONDS_REPEATING_CODE,
  // Alzheimer NL: nested $ifelse routing + $upper + $strtotime + <<…>>
  // literal envelope at the end of the template.
  ALZHEIMER_NL_CODE_BEFORE,
  ALZHEIMER_NL_REPEATING_CODE,
  // Amnesty: comma-separated CSV with welcome-call branching, embedded
  // single quotes around field-ref operands.
  AMNESTY_CODE_BEFORE,
  AMNESTY_REPEATING_CODE,
  // Amref: country-code switch + inline $query[SELECT … LIMIT 1;] with
  // a templated WHERE clause referencing {471: id}.
  AMREF_CODE_BEFORE,
  AMREF_REPEATING_CODE,
]

describe('round-trip', () => {
  for (const src of corpus) {
    it(`serialize(parse(${JSON.stringify(src.slice(0, 60))})) === src`, () => {
      const { tree, diagnostics } = parse(src)
      expect(diagnostics.hasErrors).toBe(false)
      expect(serialize(tree)).toBe(src)
    })
  }
})
