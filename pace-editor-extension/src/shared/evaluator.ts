import { IRNode, IRTree, FuncNode, FuncArg } from './ir-types'

export interface EvalContext {
  // Field values keyed by raw ref ("471: id"), by id alone ("471"),
  // and by id-subid ("34-445"). Lookups try the raw key first, then the
  // numeric prefix before the first ":".
  fields: Map<string, string>
  vars: Map<string, string>
  rowIndex: number
  // Trace records, when present, get one entry per evaluated node so the
  // simulator can highlight which branch produced which characters.
  trace?: TraceEntry[]
}

export interface TraceEntry {
  node: IRNode
  output: string
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
  let value: string
  switch (node.kind) {
    case 'text':
      value = node.value
      break
    case 'field':
      value = lookupField(node.raw, ctx)
      break
    case 'func':
      value = evalFunc(node, ctx)
      break
  }
  ctx.trace?.push({ node, output: value })
  return value
}

function lookupField(raw: string, ctx: EvalContext): string {
  if (ctx.fields.has(raw)) return ctx.fields.get(raw)!
  const colon = raw.indexOf(':')
  if (colon !== -1) {
    const id = raw.substring(0, colon).trim()
    if (ctx.fields.has(id)) return ctx.fields.get(id)!
  }
  // Pace itself renders a missing field as the empty string in the output.
  // Conditional logic ($if, $strlen, …) therefore needs an empty fallback
  // here, otherwise every conditional that guards on a missing field would
  // silently take the truthy branch.
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
      const name = evalArg(args[0], ctx)
      return ctx.vars.get(name) ?? ''
    }
    case '$storevar': {
      const name = evalArg(args[0], ctx)
      const value = evalArg(args[1], ctx)
      ctx.vars.set(name, value)
      return ''
    }
    case '$date': {
      const format = evalArg(args[0], ctx) || 'Y-m-d'
      const sourceArg = args[1] ? evalArg(args[1], ctx) : ''
      const d = sourceArg ? new Date(sourceArg) : new Date()
      if (Number.isNaN(d.getTime())) return sourceArg
      return formatDate(format, d)
    }
    case '$substr': {
      const str = evalArg(args[0], ctx)
      const start = parseInt(evalArg(args[1], ctx) || '0', 10)
      const lenRaw = args[2] ? evalArg(args[2], ctx) : ''
      const len = lenRaw === '' ? undefined : parseInt(lenRaw, 10)
      return len === undefined ? str.substring(start) : str.substring(start, start + len)
    }
    case '$replace': {
      const search = evalArg(args[0], ctx)
      const replacement = evalArg(args[1], ctx)
      const subject = evalArg(args[2], ctx)
      return search === '' ? subject : subject.split(search).join(replacement)
    }
    case '$strtolower':
      return evalArg(args[0], ctx).toLowerCase()
    case '$strtoupper':
      return evalArg(args[0], ctx).toUpperCase()
    case '$trim':
      return evalArg(args[0], ctx).trim()
    case '$strlen':
      return String(evalArg(args[0], ctx).length)
    case '$pad': {
      const str = evalArg(args[0], ctx)
      const len = parseInt(evalArg(args[1], ctx) || '0', 10)
      const padChar = (evalArg(args[2], ctx) || ' ').slice(0, 1) || ' '
      const dir = evalArg(args[3], ctx) || 'right'
      return dir === 'left' ? str.padStart(len, padChar) : str.padEnd(len, padChar)
    }
    case '$if': {
      const cond = evalArg(args[0], ctx)
      const truthy = isTruthy(cond)
      if (truthy) return evalArg(args[1], ctx)
      return args[2] ? evalArg(args[2], ctx) : ''
    }
    case '$ifelse': {
      const val = evalArg(args[0], ctx)
      if (isTruthy(val)) return evalArg(args[1], ctx)
      return args[2] ? evalArg(args[2], ctx) : ''
    }
    case '$concat':
      return args.map((a) => evalArg(a, ctx)).join('')
    case '$count':
      return String(ctx.rowIndex + 1)
    case '$linebreak':
      return '\n'
    case '$tab':
      return '\t'
    case '$semicolon':
      return ';'
    default:
      // Unknown function — fall through to a textual placeholder. This keeps
      // generated output readable instead of silently dropping content.
      return `${node.name}[${args.map((a) => evalArg(a, ctx)).join(',')}]`
  }
}

function isTruthy(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '0' || trimmed.toLowerCase() === 'false') {
    return false
  }
  return true
}

function formatDate(format: string, d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  // Process tokens left-to-right with a single scan so that one substitution
  // can't accidentally consume characters meant for the next token.
  let out = ''
  for (let i = 0; i < format.length; i++) {
    const ch = format[i]
    switch (ch) {
      case 'Y': out += d.getFullYear(); break
      case 'y': out += pad(d.getFullYear() % 100); break
      case 'm': out += pad(d.getMonth() + 1); break
      case 'd': out += pad(d.getDate()); break
      case 'H': out += pad(d.getHours()); break
      case 'i': out += pad(d.getMinutes()); break
      case 's': out += pad(d.getSeconds()); break
      default: out += ch
    }
  }
  return out
}
