import {
  IRNode,
  IRTree,
  FuncNode,
  FuncArg,
  TextNode,
  FieldNode,
  ParseDiagnostics,
} from './ir-types'

// Round-trip property:
//   serialize(parse(s)) === s, for every s the parser accepts.
//
// The strategy is to never discard a character. Text outside functions and
// fields ends up in a TextNode verbatim. Whitespace around commas inside
// a function argument list is captured into FuncArg.prefix.

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

function readFuncName(cur: Cursor): string {
  // Caller has confirmed cur.src[cur.i] === '$'.
  let name = '$'
  cur.i++
  while (cur.i < cur.src.length && isFuncNameChar(cur.src[cur.i])) {
    name += cur.src[cur.i]
    cur.i++
  }
  return name
}

function readWhitespacePrefix(cur: Cursor): string {
  let ws = ''
  while (cur.i < cur.src.length) {
    const ch = cur.src[cur.i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      ws += ch
      cur.i++
    } else {
      break
    }
  }
  return ws
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
  // Pace field refs never contain a `{` inside their braces — bail out and
  // treat the outer `{` as literal text if we see one.
  const inner = cur.src.substring(start + 1, close)
  if (inner.includes('{')) {
    return null
  }
  cur.i = close + 1
  return { kind: 'field', raw: inner }
}

function parseFunction(cur: Cursor): FuncNode | null {
  // Caller has confirmed cur.src[cur.i] === '$'.
  const start = cur.i
  const name = readFuncName(cur)
  if (name === '$') {
    // Lone `$` is treated as literal text by the caller.
    cur.i = start
    return null
  }
  if (cur.i >= cur.src.length || cur.src[cur.i] !== '[') {
    // No brackets — function without args, eg. `$count`, `$tab`.
    return { kind: 'func', name, args: null }
  }
  cur.i++ // consume `[`
  const args: FuncArg[] = []
  let closed = false
  // Each iteration reads one argument until we see the matching `]`.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (cur.i >= cur.src.length) break
    const prefix = readWhitespacePrefix(cur)
    const argNodes: IRNode[] = []
    parseUntil(cur, argNodes, /* stopOnComma */ true)
    args.push({ prefix, nodes: argNodes })
    if (cur.i >= cur.src.length) break
    if (cur.src[cur.i] === ',') {
      cur.i++
      continue
    }
    if (cur.src[cur.i] === ']') {
      cur.i++
      closed = true
      break
    }
  }
  if (!closed) {
    const { line, column } = locOf(cur.src, start)
    cur.diag.push(
      `Unclosed function call ${name}[…] (missing \`]\`)`,
      start,
      line,
      column,
    )
  }
  return { kind: 'func', name, args }
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

function parseUntil(
  cur: Cursor,
  out: IRNode[],
  stopOnComma: boolean,
): void {
  while (cur.i < cur.src.length) {
    const ch = cur.src[cur.i]
    if (ch === ']') return
    if (stopOnComma && ch === ',') return
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
  parseUntil(cur, tree, /* stopOnComma */ false)
  return { tree, diagnostics: diag }
}
