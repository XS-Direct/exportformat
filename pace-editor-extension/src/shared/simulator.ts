import { evaluate, createContext, EvalContext } from './evaluator'
import { parse } from './parser'
import type { FixtureBundle, Scenario } from './fixtures/types'

export interface RowResult {
  scenarioId: string
  description: string
  raw: string
  columns: string[]
  diff: ColumnDiff[]
}

export interface ColumnDiff {
  index: number
  actual: string
  expected: string | null | undefined
  ok: boolean
}

export interface SimulationOutput {
  rows: RowResult[]
  // Concatenated raw output (header + rows + footer) so the user can copy it
  // into a downstream test or download as a file.
  combined: string
}

export interface SimulationInputs {
  codeBefore: string
  repeatingCode: string
  codeAfter: string
  bundle: FixtureBundle
  // Extra field defaults that should apply to every scenario unless the
  // scenario itself overrides them (eg. host-injected $date constants).
  globalFields?: Record<string, string>
}

function buildContext(scenario: Scenario, global: Record<string, string> | undefined, rowIndex: number): EvalContext {
  const fields = new Map<string, string>()
  if (global) for (const [k, v] of Object.entries(global)) fields.set(k, v)
  for (const [k, v] of Object.entries(scenario.record.fields)) fields.set(k, v)
  const ctx = createContext(fields, rowIndex)
  if (scenario.record.vars) {
    for (const [k, v] of Object.entries(scenario.record.vars)) ctx.vars.set(k, v)
  }
  return ctx
}

export function runSimulation(inputs: SimulationInputs): SimulationOutput {
  const before = parse(inputs.codeBefore).tree
  const repeating = parse(inputs.repeatingCode).tree
  const after = parse(inputs.codeAfter).tree

  // The header context is shared across all rows because real Pace exports
  // run codeBefore once, then iterate. Variables stored in codeBefore must
  // remain visible inside the repeating block.
  const headerCtx = createContext(new Map(), 0)
  const header = evaluate(before, headerCtx)

  const rows: RowResult[] = []
  let combinedRows = ''
  inputs.bundle.scenarios.forEach((scenario, rowIndex) => {
    const ctx = buildContext(scenario, inputs.globalFields, rowIndex)
    // Header-scoped vars carry over so repeating-block branches that depend on
    // header initialisation behave the same as in production.
    for (const [k, v] of headerCtx.vars) {
      if (!ctx.vars.has(k)) ctx.vars.set(k, v)
    }
    const raw = evaluate(repeating, ctx)
    combinedRows += raw
    // Pace writes columns separated by the HTML tab entity (`&#9;`). The
    // entity is decoded to a real TAB at file-write time downstream, but
    // for column comparison we do the same decoding here.
    const normalized = raw.replace(/&#9;/g, '\t')
    const columns = normalized.split('\t')
    const expectedCols = scenario.expected?.columns ?? []
    const diff: ColumnDiff[] = columns.map((actual, i) => {
      const expected = expectedCols[i]
      const ok = expected === undefined || expected === null || actual === expected
      return { index: i, actual, expected, ok }
    })
    rows.push({
      scenarioId: scenario.id,
      description: scenario.description,
      raw,
      columns,
      diff,
    })
  })

  const footerCtx = createContext(new Map(), rows.length)
  for (const [k, v] of headerCtx.vars) footerCtx.vars.set(k, v)
  const footer = evaluate(after, footerCtx)

  return {
    rows,
    combined: header + combinedRows + footer,
  }
}

export function toCsv(rows: RowResult[], delimiter = ','): string {
  // CSV with RFC-4180-ish quoting: wrap any column containing the delimiter,
  // a quote, or a newline; double-up embedded quotes.
  const escape = (s: string) => {
    if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return rows.map((r) => r.columns.map(escape).join(delimiter)).join('\n')
}

export function toTsv(rows: RowResult[]): string {
  // TSV uses no quoting — Pace's own output is TAB-separated raw text, so
  // mirroring that gives a byte-identical comparison surface.
  return rows.map((r) => r.columns.join('\t')).join('\n')
}
