import { IRNode, IRTree, FuncNode, FuncArg } from './ir-types'
import { evaluateCondition } from './expr'

export interface EvalContext {
  // Field values keyed by either the raw ref ("471: id"), the bare numeric
  // id ("471"), or any prefix-id ("34-445"). lookupField also handles
  // {var:NAME} refs by routing them to ctx.vars.
  fields: Map<string, string>
  vars: Map<string, string>
  rowIndex: number
}

export function createContext(
  fields: Iterable<[string, string]>,
  rowIndex = 0,
): EvalContext {
  return { fields: new Map(fields), vars: new Map(), rowIndex }
}

export function evaluate(tree: IRTree, ctx: EvalContext): string {
  let out = ''
  for (const node of tree) out += evalNode(node, ctx)
  return out
}

function evalNode(node: IRNode, ctx: EvalContext): string {
  switch (node.kind) {
    case 'text': return node.value
    case 'field': return lookupField(node.raw, ctx)
    case 'func': return evalFunc(node, ctx)
  }
}

function lookupField(raw: string, ctx: EvalContext): string {
  // {var:NAME} variant — Pace's inline variable reference shorthand for
  // $var[NAME]. The colon separates the kind from the variable name.
  if (raw.startsWith('var:')) {
    const name = raw.substring(4).trim()
    return ctx.vars.get(name) ?? ''
  }
  if (ctx.fields.has(raw)) return ctx.fields.get(raw)!
  const colon = raw.indexOf(':')
  if (colon !== -1) {
    const id = raw.substring(0, colon).trim()
    if (ctx.fields.has(id)) return ctx.fields.get(id)!
  }
  // Pace itself renders unknown fields as the empty string, so conditional
  // logic guarding on a missing field correctly takes the falsy branch.
  return ''
}

function evalArg(arg: FuncArg | undefined, ctx: EvalContext): string {
  if (!arg) return ''
  return evaluate(arg.nodes, ctx)
}

// Evaluate simple arithmetic expressions that Pace supports in $var values.
// Handles patterns like "0 + 1", "5 - 2", "3 * 4", "{var:count} + 1" after
// field substitution. Returns the original string if it's not arithmetic.
function evalArithmetic(s: string): string {
  const trimmed = s.trim()
  // Try simple binary: number op number
  const m = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/%])\s*(-?\d+(?:\.\d+)?)$/)
  if (m) {
    const a = parseFloat(m[1])
    const op = m[2]
    const b = parseFloat(m[3])
    let result: number
    switch (op) {
      case '+': result = a + b; break
      case '-': result = a - b; break
      case '*': result = a * b; break
      case '/': result = b !== 0 ? a / b : 0; break
      case '%': result = b !== 0 ? a % b : 0; break
      default: return trimmed
    }
    return Number.isInteger(result) ? String(result) : result.toFixed(2)
  }
  return trimmed
}

function evalFunc(node: FuncNode, ctx: EvalContext): string {
  const args = node.args ?? []
  switch (node.name) {
    case '$var': {
      // $var[name]          → read variable
      // $var[name][value]   → store value, evaluate arithmetic, return empty
      if (args.length === 1) {
        return ctx.vars.get(evalArg(args[0], ctx)) ?? ''
      }
      if (args.length >= 2) {
        const raw = evalArg(args[1], ctx)
        ctx.vars.set(evalArg(args[0], ctx), evalArithmetic(raw))
        return ''
      }
      return ''
    }

    case '$if': {
      // $if[condition][then]
      const cond = evaluateCondition(evalArg(args[0], ctx))
      return cond ? evalArg(args[1], ctx) : ''
    }

    case '$ifelse': {
      // $ifelse[condition][then][else]
      const cond = evaluateCondition(evalArg(args[0], ctx))
      return cond ? evalArg(args[1], ctx) : evalArg(args[2], ctx)
    }

    case '$date': {
      // $date[source][format]. Empty source falls back to "now".
      const src = evalArg(args[0], ctx)
      const fmt = evalArg(args[1], ctx) || '%Y-%m-%d'
      const d = src ? new Date(src) : new Date()
      if (Number.isNaN(d.getTime())) return src
      return formatDate(fmt, d)
    }

    case '$substr': {
      // $substr[input][start, length?]. Length is optional; negative
      // start counts from the end.
      const str = evalArg(args[0], ctx)
      const spec = evalArg(args[1], ctx).split(',').map((s) => s.trim())
      const start = parseInt(spec[0] || '0', 10)
      const length = spec.length > 1 && spec[1] !== '' ? parseInt(spec[1], 10) : undefined
      if (start < 0) {
        return length === undefined ? str.slice(start) : str.slice(start, start + length)
      }
      return length === undefined ? str.substring(start) : str.substring(start, start + length)
    }

    case '$replace': {
      // $replace[search][replace][subject]
      const search = evalArg(args[0], ctx)
      const replacement = evalArg(args[1], ctx)
      const subject = evalArg(args[2], ctx)
      return search === '' ? subject : subject.split(search).join(replacement)
    }

    case '$strtolower': return evalArg(args[0], ctx).toLowerCase()
    case '$strtoupper': return evalArg(args[0], ctx).toUpperCase()
    case '$trim': return evalArg(args[0], ctx).trim()
    case '$strlen': return String(evalArg(args[0], ctx).length)

    case '$pad': {
      // $pad[input][length][padChar?][direction?]
      const str = evalArg(args[0], ctx)
      const len = parseInt(evalArg(args[1], ctx) || '0', 10)
      const padChar = (evalArg(args[2], ctx) || ' ').slice(0, 1) || ' '
      const dir = evalArg(args[3], ctx) || 'right'
      return dir === 'left' ? str.padStart(len, padChar) : str.padEnd(len, padChar)
    }

    case '$concat':
      // Concatenation in the new syntax means writing args adjacent to one
      // another — $concat is therefore a passthrough that joins them.
      return args.map((a) => evalArg(a, ctx)).join('')

    case '$storevar': {
      // $storevar[name] — persists the variable for the next row. In the
      // real Pace runtime this writes to server-side state; in the simulator
      // it's equivalent to a no-op read (the var was already set by $var).
      // It never produces output.
      return ''
    }

    case '$rem': {
      // $rem[comment] — developer comment, never produces output.
      return ''
    }

    case '$query': {
      // $query[sql] — database query, can't be simulated. Return placeholder.
      return '(query)'
    }

    case '$getuuid': {
      // $getuuid[] — generate a UUID placeholder.
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    }

    case '$count': return String(ctx.rowIndex + 1)
    case '$linebreak': return '\n'
    case '$tab': return '\t'
    case '$semicolon': return ';'

    default:
      // Unknown function: reproduce its surface form so the output remains
      // useful for debugging instead of silently dropping content.
      if (node.args === null) return node.name
      return node.name + node.args.map((a) => `[${evalArg(a, ctx)}]`).join('')
  }
}

function formatDate(format: string, d: Date): string {
  // strftime-style tokens with `%` prefix. Unknown `%X` sequences are left
  // in the output verbatim so the user can spot them.
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  let out = ''
  for (let i = 0; i < format.length; i++) {
    if (format[i] !== '%' || i + 1 >= format.length) {
      out += format[i]
      continue
    }
    const token = format[i + 1]
    i++
    switch (token) {
      case 'Y': out += d.getFullYear(); break
      case 'y': out += pad(d.getFullYear() % 100); break
      case 'm': out += pad(d.getMonth() + 1); break
      case 'd': out += pad(d.getDate()); break
      case 'H': out += pad(d.getHours()); break
      case 'M': out += pad(d.getMinutes()); break
      case 'S': out += pad(d.getSeconds()); break
      case '%': out += '%'; break
      default: out += '%' + token
    }
  }
  return out
}
