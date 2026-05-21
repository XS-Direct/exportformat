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

function evalFunc(node: FuncNode, ctx: EvalContext): string {
  const args = node.args ?? []
  switch (node.name) {
    case '$var': {
      // $var[name]          → read variable
      // $var[name][value]   → store value and return empty so the call
      //                       doesn't pollute the surrounding template
      if (args.length === 1) {
        return ctx.vars.get(evalArg(args[0], ctx)) ?? ''
      }
      if (args.length >= 2) {
        ctx.vars.set(evalArg(args[0], ctx), evalArg(args[1], ctx))
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
    case '$strtoupper':
    case '$upper':
      return evalArg(args[0], ctx).toUpperCase()
    case '$ucfirst': {
      const s = evalArg(args[0], ctx)
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
    case '$trim': return evalArg(args[0], ctx).trim()
    case '$strlen': return String(evalArg(args[0], ctx).length)

    case '$strtotime': {
      // Pace inherits PHP's strtotime() semantics. Real PHP recognises a
      // long list of phrases; we cover the ones we've seen in production
      // templates (first day / last day, today/tomorrow/yesterday) and
      // fall back to native Date parsing for anything else.
      const expr = evalArg(args[0], ctx).trim().toLowerCase()
      const now = new Date()
      const iso = (d: Date) =>
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      if (expr === 'today' || expr === 'now') return iso(now)
      if (expr === 'tomorrow') return iso(new Date(now.getTime() + 86400000))
      if (expr === 'yesterday') return iso(new Date(now.getTime() - 86400000))
      if (expr === 'first day of this month') return iso(new Date(now.getFullYear(), now.getMonth(), 1))
      if (expr === 'first day of next month') return iso(new Date(now.getFullYear(), now.getMonth() + 1, 1))
      if (expr === 'first day of last month') return iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      if (expr === 'last day of this month') return iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      if (expr === 'last day of next month') return iso(new Date(now.getFullYear(), now.getMonth() + 2, 0))
      const native = new Date(expr)
      return Number.isNaN(native.getTime()) ? expr : iso(native)
    }

    case '$query':
      // Pace executes SQL against its own database at export time. The
      // simulator obviously can't, so $query degrades to an empty string
      // — that matches what real templates use $query for (lookups whose
      // result is downstream-formatted), and keeps preview output
      // predictable.
      return ''

    case '$storevar':
      // Real Pace uses $storevar[name] as a "commit" of a counter to the
      // export stream. For our purposes it behaves the same as $var:
      // one arg reads, two args write.
      if (args.length === 1) return ctx.vars.get(evalArg(args[0], ctx)) ?? ''
      if (args.length >= 2) {
        ctx.vars.set(evalArg(args[0], ctx), evalArg(args[1], ctx))
        return ''
      }
      return ''

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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
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
