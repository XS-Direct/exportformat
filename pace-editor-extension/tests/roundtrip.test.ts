import { describe, it, expect } from 'vitest'
import { parse } from '../src/shared/parser'
import { serialize } from '../src/shared/serializer'

const corpus: string[] = [
  '',
  'plain text',
  '{471: id}',
  'id={471: id}\t{34-445: Person: Sex}\n',
  '$count',
  '$tab[]',
  '$if[{471: id}, yes, no]',
  '$ifelse[$strtolower[{12-100: Person: Lastname}], present, ]',
  // Real-world-ish templates with deep nesting and TAB-separated columns.
  '$storevar[org, Alzheimer NL]{471: id}\t{34-445: Person: Sex}\t$var[org]\t$if[$ifelse[{99-7: Project}, $strlen[{99-7: Project}], 0], WV26063, {99-7: Project}]\t{50-1: Person: Firstname}\t{50-2: Person: Lastname}\n',
  '$if[a,   b,\n  c]',
  '$concat[a,b,,d]',
  // Pathological but legal: whitespace-only args, trailing comma free use.
  '$if[ , ,   ]',
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
