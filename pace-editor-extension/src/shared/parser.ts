import {
  IRNode,
  IRTree,
  FuncNode,
  FuncArg,
  TextNode,
  FieldNode,
  ParseDiagnostics,
} from './ir-types'

// Round-trip property: serialize(parse(x)) === x for every accepted x.
//
// The grammar is intentionally permissive: anything that isn't a field
// reference or a function call ends up verbatim in a text node, including
// literal commas, angle brackets, single quotes and HTML entities like
// "&#9;" that Pace uses as column separators.

interface Cursor {
  src: string
  i: number
  diag: ParseDiagnostics
}

function locOf(src: string, index: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

function isFuncNameChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch)
}

function appendText(out: IRNode[], chunk: string): void {
  if (!chunk) return
  const last = out[out.length - 1]
  if (last && last.kind === 'text') {
    ;(last as TextNode).value += chunk
  } else {
    out.push({ kind: 'text', value: chunk })
  }
}

function parseField(cur: Cursor): FieldNode | null {
  // Caller has confirmed cur.src[cur.i] === '{'.
  const start = cur.i
  const close = cur.src.indexOf('}', start + 1)
  if (close === -1) {
    const { line, column } = locOf(cur.src, start)
    cur.diag.push('Unclosed field reference (missing `}`)', start, line, column)
    return null
  }
  const inner = cur.src.substring(start + 1, close)
  // Pace field refs never contain `{` inside their braces. If they do, fall
  // back to treating the outer `{` as literal text — otherwise the parser
  // would silently include unrelated content that probably wasn't intended.
  if (inner.includes('{')) return null
  cur.i = close + 1
  return { kind: 'field', raw: inner }
}

function parseFunction(cur: Cursor): FuncNode | null {
  // Caller has confirmed cur.src[cur.i] === '$'.
  const start = cur.i
  let name = '$'
  cur.i++
  while (cur.i < cur.src.length && isFuncNameChar(cur.src[cur.i])) {
    name += cur.src[cur.i]
    cur.i++
  }
  if (name === '$') {
    cur.i = start
    return null
  }
  if (cur.i >= cur.src.length || cur.src[cur.i] !== '[') {
    return { kind: 'func', name, args: null }
  }
  const args: FuncArg[] = []
  while (cur.i < cur.src.length && cur.src[cur.i] === '[') {
    cur.i++ // consume '['
    const nodes: IRNode[] = []
    parseUntilCloseBracket(cur, nodes)
    if (cur.i < cur.src.length && cur.src[cur.i] === ']') {
      cur.i++
    } else {
      const { line, column } = locOf(cur.src, start)
      cur.diag.push(
        `Unclosed function call ${name}[…] (missing \`]\`)`,
        start,
        line,
        column,
      )
    }
    args.push({ nodes })
  }
  return { kind: 'func', name, args }
}

function parseUntilCloseBracket(cur: Cursor, out: IRNode[]): void {
  while (cur.i < cur.src.length) {
    const ch = cur.src[cur.i]
    if (ch === ']') return
    if (ch === '{') {
      const before = cur.i
      const field = parseField(cur)
      if (field) {
        out.push(field)
      } else {
        appendText(out, cur.src[before])
        cur.i = before + 1
      }
      continue
    }
    if (ch === '$' && cur.i + 1 < cur.src.length && isFuncNameChar(cur.src[cur.i + 1])) {
      const fn = parseFunction(cur)
      if (fn) {
        out.push(fn)
        continue
      }
    }
    appendText(out, ch)
    cur.i++
  }
}

function parseTopLevel(cur: Cursor, out: IRNode[]): void {
  while (cur.i < cur.src.length) {
    const ch = cur.src[cur.i]
    if (ch === '{') {
      const before = cur.i
      const field = parseField(cur)
      if (field) {
        out.push(field)
      } else {
        appendText(out, cur.src[before])
        cur.i = before + 1
      }
      continue
    }
    if (ch === '$' && cur.i + 1 < cur.src.length && isFuncNameChar(cur.src[cur.i + 1])) {
      const fn = parseFunction(cur)
      if (fn) {
        out.push(fn)
        continue
      }
    }
    appendText(out, ch)
    cur.i++
  }
}

export function parse(src: string): { tree: IRTree; diagnostics: ParseDiagnostics } {
  const diag = new ParseDiagnostics()
  const cur: Cursor = { src, i: 0, diag }
  const tree: IRTree = []
  parseTopLevel(cur, tree)
  return { tree, diagnostics: diag }
}
