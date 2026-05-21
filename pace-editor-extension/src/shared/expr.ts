// Boolean expression evaluator for the strings produced by evaluating a
// condition template. Pace conditions look like
//
//   {22-326: Project: id} == 205 || {22-326: Project: id} == 206
//   '{803: Method override}' == 'door-to-door'
//   $substr[X][0,2] != 06 && {…: Status} == valid
//
// After template substitution these collapse to plain strings such as
// "205 == 206 || 205 == 207" or "'door-to-door' == 'door-to-door'", which
// this module then tokenises and evaluates.
//
// Grammar (lowest to highest precedence):
//   or_expr  := and_expr ('||' and_expr)*
//   and_expr := cmp_expr ('&&' cmp_expr)*
//   cmp_expr := atom (cmp_op atom)?
//   atom     := '(' or_expr ')' | literal
//   literal  := number | quoted_string | bare_word

type CmpOp = '==' | '!=' | '>=' | '<=' | '>' | '<'
type Token =
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'or' }
  | { kind: 'and' }
  | { kind: 'cmp'; op: CmpOp }
  | { kind: 'lit'; value: string; quoted: boolean }

const NUMERIC = /^-?\d+(?:\.\d+)?$/

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (ch === '(') { tokens.push({ kind: 'lparen' }); i++; continue }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i++; continue }
    if (ch === '|' && src[i + 1] === '|') { tokens.push({ kind: 'or' }); i += 2; continue }
    if (ch === '&' && src[i + 1] === '&') { tokens.push({ kind: 'and' }); i += 2; continue }
    if (ch === '=' && src[i + 1] === '=') { tokens.push({ kind: 'cmp', op: '==' }); i += 2; continue }
    if (ch === '!' && src[i + 1] === '=') { tokens.push({ kind: 'cmp', op: '!=' }); i += 2; continue }
    if (ch === '>' && src[i + 1] === '=') { tokens.push({ kind: 'cmp', op: '>=' }); i += 2; continue }
    if (ch === '<' && src[i + 1] === '=') { tokens.push({ kind: 'cmp', op: '<=' }); i += 2; continue }
    if (ch === '>') { tokens.push({ kind: 'cmp', op: '>' }); i++; continue }
    if (ch === '<') { tokens.push({ kind: 'cmp', op: '<' }); i++; continue }
    if (ch === "'" || ch === '"') {
      const quote = ch
      const start = i + 1
      let end = src.indexOf(quote, start)
      if (end === -1) end = src.length
      tokens.push({ kind: 'lit', value: src.substring(start, end), quoted: true })
      i = end + 1
      continue
    }
    // Bare literal — read until next operator/whitespace/paren character.
    // Allow `-`, `.`, `@`, alphanumerics; that covers numbers, dashed
    // identifiers like "door-to-door", IBANs, etc.
    let end = i
    while (end < src.length) {
      const c = src[end]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') break
      if (c === '(' || c === ')') break
      if (c === '|' && src[end + 1] === '|') break
      if (c === '&' && src[end + 1] === '&') break
      if (c === '=' && src[end + 1] === '=') break
      if (c === '!' && src[end + 1] === '=') break
      if (c === '>' || c === '<') break
      end++
    }
    if (end === i) { i++; continue }
    tokens.push({ kind: 'lit', value: src.substring(i, end), quoted: false })
    i = end
  }
  return tokens
}

class TokenStream {
  private pos = 0
  constructor(private tokens: Token[]) {}
  peek(): Token | undefined { return this.tokens[this.pos] }
  next(): Token | undefined { return this.tokens[this.pos++] }
}

function parseAtom(ts: TokenStream): boolean | string {
  const tok = ts.peek()
  if (!tok) return ''
  if (tok.kind === 'lparen') {
    ts.next()
    const value = parseOr(ts)
    if (ts.peek()?.kind === 'rparen') ts.next()
    return value
  }
  if (tok.kind === 'lit') {
    ts.next()
    return tok.value
  }
  // Not an atom (operator/separator at the head). Leave the token in the
  // stream for the outer parser and return an empty literal — that way
  // `X !=  && Y == 1` parses as `(X != "") && (Y == 1)` instead of
  // accidentally consuming the `&&` into the right-hand side.
  return ''
}

function compareValues(left: string, op: CmpOp, right: string): boolean {
  // Numeric comparison when both sides look numeric. Falls back to string
  // comparison so "door-to-door" == "door-to-door" works.
  const lNum = NUMERIC.test(left.trim())
  const rNum = NUMERIC.test(right.trim())
  if (lNum && rNum) {
    const a = parseFloat(left), b = parseFloat(right)
    switch (op) {
      case '==': return a === b
      case '!=': return a !== b
      case '>': return a > b
      case '<': return a < b
      case '>=': return a >= b
      case '<=': return a <= b
    }
  }
  switch (op) {
    case '==': return left === right
    case '!=': return left !== right
    case '>': return left > right
    case '<': return left < right
    case '>=': return left >= right
    case '<=': return left <= right
  }
}

function asBoolean(v: boolean | string): boolean {
  if (typeof v === 'boolean') return v
  const trimmed = v.trim()
  if (trimmed === '' || trimmed === '0' || trimmed.toLowerCase() === 'false') return false
  return true
}

function parseCmp(ts: TokenStream): boolean {
  const left = parseAtom(ts)
  const next = ts.peek()
  if (next && next.kind === 'cmp') {
    ts.next()
    const right = parseAtom(ts)
    return compareValues(
      typeof left === 'boolean' ? String(left) : left,
      next.op,
      typeof right === 'boolean' ? String(right) : right,
    )
  }
  return asBoolean(left)
}

function parseAnd(ts: TokenStream): boolean {
  let result = parseCmp(ts)
  while (ts.peek()?.kind === 'and') {
    ts.next()
    const rhs = parseCmp(ts)
    result = result && rhs
  }
  return result
}

function parseOr(ts: TokenStream): boolean {
  let result = parseAnd(ts)
  while (ts.peek()?.kind === 'or') {
    ts.next()
    const rhs = parseAnd(ts)
    result = result || rhs
  }
  return result
}

export function evaluateCondition(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  const tokens = tokenize(trimmed)
  if (tokens.length === 0) return false
  // A single bare literal counts as "truthy if non-empty" — matches the
  // legacy behaviour where $if[someValue][then] meant "if someValue is set".
  if (tokens.length === 1 && tokens[0].kind === 'lit') {
    return asBoolean(tokens[0].value)
  }
  return parseOr(new TokenStream(tokens))
}
