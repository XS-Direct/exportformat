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

  // {curdate}, {curdatetime}, {curyear}, etc. — current date/time tokens
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (raw === 'curdate') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  if (raw === 'curdatetime') return now.toISOString().slice(0, 19).replace('T', ' ')
  if (raw === 'curyear') return String(now.getFullYear())
  if (raw === 'curmonth') return pad(now.getMonth() + 1)
  if (raw === 'curday') return pad(now.getDate())
  if (raw === 'curhour') return pad(now.getHours())
  if (raw === 'curmin') return pad(now.getMinutes())
  if (raw === 'cursec') return pad(now.getSeconds())
  if (raw === 'curtime') return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  // {curdate:+3days}, {curdate:-1 week} — relative date offset
  if (raw.startsWith('curdate:') || raw.startsWith('customdate:')) {
    const offset = raw.split(':').slice(1).join(':').trim()
    try {
      const d = parseDateOffset(now, offset)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    } catch { return raw }
  }

  if (ctx.fields.has(raw)) return ctx.fields.get(raw)!
  const colon = raw.indexOf(':')
  if (colon !== -1) {
    const id = raw.substring(0, colon).trim()
    if (ctx.fields.has(id)) return ctx.fields.get(id)!
  }
  return ''
}

// Parse relative date offsets like "+3days", "-1 week", "+2 months"
function parseDateOffset(base: Date, offset: string): Date {
  const d = new Date(base)
  const m = offset.match(/([+-]?\d+)\s*(day|week|month|year|hour|minute|second)s?/i)
  if (!m) return d
  const n = parseInt(m[1], 10)
  const unit = m[2].toLowerCase()
  switch (unit) {
    case 'day': d.setDate(d.getDate() + n); break
    case 'week': d.setDate(d.getDate() + n * 7); break
    case 'month': d.setMonth(d.getMonth() + n); break
    case 'year': d.setFullYear(d.getFullYear() + n); break
    case 'hour': d.setHours(d.getHours() + n); break
    case 'minute': d.setMinutes(d.getMinutes() + n); break
    case 'second': d.setSeconds(d.getSeconds() + n); break
  }
  return d
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

    // --- String functions ---
    case '$strtolower':
    case '$lower': return evalArg(args[0], ctx).toLowerCase()
    case '$strtoupper':
    case '$upper': return evalArg(args[0], ctx).toUpperCase()
    case '$trim': return evalArg(args[0], ctx).trim()
    case '$strlen':
    case '$len': return String(evalArg(args[0], ctx).length)
    case '$ucfirst': {
      const s = evalArg(args[0], ctx)
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
    case '$addslashes': return evalArg(args[0], ctx).replace(/['"\\]/g, '\\$&')
    case '$htmlentities': return evalArg(args[0], ctx).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    case '$striptags': return evalArg(args[0], ctx).replace(/<[^>]*>/g, '')
    case '$stripnum': return evalArg(args[0], ctx).replace(/\d/g, '')
    case '$nltobr': return evalArg(args[0], ctx).replace(/\n/g, '<br>')
    case '$jsonencode': {
      try { return JSON.stringify(evalArg(args[0], ctx)) } catch { return '' }
    }
    case '$urlencode': return encodeURIComponent(evalArg(args[0], ctx))
    case '$urldecode': return decodeURIComponent(evalArg(args[0], ctx))
    case '$urlfriendly': {
      return evalArg(args[0], ctx)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
    }

    // --- Numeric functions ---
    case '$int': return String(parseInt(evalArg(args[0], ctx), 10) || 0)
    case '$round': {
      const val = parseFloat(evalArg(args[0], ctx))
      const dec = parseInt(evalArg(args[1], ctx) || '0', 10)
      return Number.isNaN(val) ? '0' : val.toFixed(dec)
    }
    case '$numformat': {
      // $numformat[input][decimals][dec_sep][thou_sep]
      const val = parseFloat(evalArg(args[0], ctx)) || 0
      const dec = parseInt(evalArg(args[1], ctx) || '0', 10)
      const decSep = evalArg(args[2], ctx) || '.'
      const thousSep = evalArg(args[3], ctx) || ''
      const parts = val.toFixed(dec).split('.')
      if (thousSep) {
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousSep)
      }
      return parts.join(decSep)
    }
    case '$rand': {
      const spec = evalArg(args[0], ctx).split(',').map((s) => parseInt(s.trim(), 10))
      const min = spec[0] || 0
      const max = spec[1] || 100
      return String(Math.floor(Math.random() * (max - min + 1)) + min)
    }
    case '$pos': {
      const input = evalArg(args[0], ctx)
      const search = evalArg(args[1], ctx)
      const pos = input.indexOf(search)
      return pos === -1 ? '' : String(pos)
    }

    // --- Date functions ---
    case '$dateutc': {
      const src = evalArg(args[0], ctx)
      const fmt = evalArg(args[1], ctx) || '%Y-%m-%d'
      const d = src ? new Date(src) : new Date()
      if (Number.isNaN(d.getTime())) return src
      // Shift to UTC
      const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
      return formatDate(fmt, utc)
    }
    case '$strtotime': {
      const d = new Date(evalArg(args[0], ctx))
      return Number.isNaN(d.getTime()) ? '' : String(Math.floor(d.getTime() / 1000))
    }

    case '$pad': {
      const str = evalArg(args[0], ctx)
      const len = parseInt(evalArg(args[1], ctx) || '0', 10)
      const padChar = (evalArg(args[2], ctx) || ' ').slice(0, 1) || ' '
      const dir = evalArg(args[3], ctx) || 'right'
      return dir === 'left' ? str.padStart(len, padChar) : str.padEnd(len, padChar)
    }

    case '$concat':
      return args.map((a) => evalArg(a, ctx)).join('')

    // --- Variable persistence (no output) ---
    case '$storevar': return ''
    case '$storeallvars': return ''
    case '$settimezone': return ''
    case '$rem': return ''

    // --- Server-side functions (placeholders) ---
    case '$query': return '(query)'
    case '$import': return '(import)'
    case '$param': return ''
    case '$iter': return '(iter)'
    case '$count': {
      // Legacy $count[field] counts related rows — needs DB.
      // Our $count (no args) returns row index.
      if (args.length === 0 || (args.length === 1 && evalArg(args[0], ctx) === '')) {
        return String(ctx.rowIndex + 1)
      }
      return '(count)'
    }
    case '$sum': return '(sum)'

    case '$getuuid': return crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'

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

function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime())
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function getISOWeekYear(d: Date): number {
  const tmp = new Date(d.getTime())
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  return tmp.getFullYear()
}

function formatDate(format: string, d: Date): string {
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
      case 'e': out += String(d.getDate()); break // day without leading zero
      case 'H': out += pad(d.getHours()); break
      case 'I': out += pad(d.getHours() % 12 || 12); break // 12-hour
      case 'M': out += pad(d.getMinutes()); break
      case 'S': out += pad(d.getSeconds()); break
      case 'V': out += pad(getISOWeek(d)); break // ISO week number
      case 'W': out += pad(getISOWeek(d)); break // alias
      case 'g': out += pad(getISOWeekYear(d) % 100); break // ISO week year (2-digit)
      case 'G': out += getISOWeekYear(d); break // ISO week year (4-digit)
      case 'u': out += d.getDay() || 7; break // day of week (1=Mon, 7=Sun)
      case 'w': out += d.getDay(); break // day of week (0=Sun)
      case 'j': out += String(Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)).padStart(3, '0'); break
      case 'p': out += d.getHours() < 12 ? 'AM' : 'PM'; break
      case 'n': out += '\n'; break
      case 't': out += '\t'; break
      case '%': out += '%'; break
      default: out += '%' + token
    }
  }
  return out
}
