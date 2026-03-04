import type { MockField } from './useModels'

interface ParserContext {
  fields: Map<string, string>
  vars: Map<string, string>
  rowIndex: number
}

function resolveFieldRef(ref: string, ctx: ParserContext): string {
  // Match field references like {34-445: Person: Sex} or {471: id}
  const key = ref.trim()
  return ctx.fields.get(key) ?? `{${ref}}`
}

function evaluateExpression(expr: string, ctx: ParserContext): string {
  // Simple expression evaluator for conditions
  const trimmed = expr.trim()

  // Check for string equality: "value1" == "value2"
  const eqMatch = trimmed.match(/^"([^"]*)"?\s*==\s*"?([^"]*)"?$/)
  if (eqMatch) {
    return eqMatch[1] === eqMatch[2] ? 'true' : 'false'
  }

  // Check for not-equal
  const neqMatch = trimmed.match(/^"([^"]*)"?\s*!=\s*"?([^"]*)"?$/)
  if (neqMatch) {
    return neqMatch[1] !== neqMatch[2] ? 'true' : 'false'
  }

  // Check for empty/non-empty
  if (trimmed === '""' || trimmed === "''") return 'false'
  if (trimmed.length > 0) return 'true'
  return 'false'
}

function processFunction(name: string, args: string[], ctx: ParserContext): string {
  switch (name) {
    case '$var': {
      // $var[name] - get variable
      const varName = args[0] || ''
      return ctx.vars.get(varName) ?? ''
    }

    case '$storevar': {
      // $storevar[name, value] - store variable
      const varName = args[0] || ''
      const value = args.length > 1 ? processTemplate(args[1], ctx) : ''
      ctx.vars.set(varName, value)
      return ''
    }

    case '$date': {
      // $date[format] or $date[format, value]
      const format = args[0] || 'Y-m-d'
      const now = new Date()
      return format
        .replace('Y', String(now.getFullYear()))
        .replace('m', String(now.getMonth() + 1).padStart(2, '0'))
        .replace('d', String(now.getDate()).padStart(2, '0'))
        .replace('H', String(now.getHours()).padStart(2, '0'))
        .replace('i', String(now.getMinutes()).padStart(2, '0'))
        .replace('s', String(now.getSeconds()).padStart(2, '0'))
    }

    case '$substr': {
      // $substr[string, start, length]
      const str = processTemplate(args[0] || '', ctx)
      const start = parseInt(args[1] || '0')
      const length = args[2] ? parseInt(args[2]) : undefined
      return length !== undefined ? str.substr(start, length) : str.substr(start)
    }

    case '$replace': {
      // $replace[search, replace, subject]
      const search = args[0] || ''
      const replacement = args[1] || ''
      const subject = processTemplate(args[2] || '', ctx)
      return subject.split(search).join(replacement)
    }

    case '$strtolower': {
      return processTemplate(args[0] || '', ctx).toLowerCase()
    }

    case '$strtoupper': {
      return processTemplate(args[0] || '', ctx).toUpperCase()
    }

    case '$trim': {
      return processTemplate(args[0] || '', ctx).trim()
    }

    case '$strlen': {
      return String(processTemplate(args[0] || '', ctx).length)
    }

    case '$pad': {
      // $pad[string, length, padChar, direction]
      const str = processTemplate(args[0] || '', ctx)
      const len = parseInt(args[1] || '0')
      const padChar = args[2] || ' '
      const dir = args[3] || 'right'
      if (dir === 'left') return str.padStart(len, padChar)
      return str.padEnd(len, padChar)
    }

    case '$if': {
      // $if[condition, thenValue, elseValue?]
      const condValue = processTemplate(args[0] || '', ctx)
      const result = evaluateExpression(condValue, ctx)
      if (result === 'true' && args.length > 1) {
        return processTemplate(args[1], ctx)
      }
      if (result === 'false' && args.length > 2) {
        return processTemplate(args[2], ctx)
      }
      return ''
    }

    case '$ifelse': {
      // $ifelse[value, trueResult, falseResult]
      const val = processTemplate(args[0] || '', ctx).trim()
      if (val && val !== '' && val !== '0' && val !== 'false') {
        return args.length > 1 ? processTemplate(args[1], ctx) : ''
      }
      return args.length > 2 ? processTemplate(args[2], ctx) : ''
    }

    case '$concat': {
      return args.map((a) => processTemplate(a, ctx)).join('')
    }

    case '$count': {
      return String(ctx.rowIndex + 1)
    }

    case '$linebreak': {
      return '\n'
    }

    case '$tab': {
      return '\t'
    }

    case '$semicolon': {
      return ';'
    }

    default:
      return `${name}[${args.join(', ')}]`
  }
}

function parseFunctionCall(template: string, startIndex: number, ctx: ParserContext): { result: string; endIndex: number } {
  // Find the function name (starts with $)
  let i = startIndex
  let funcName = ''

  while (i < template.length && template[i] !== '[' && template[i] !== ' ' && template[i] !== '\n') {
    funcName += template[i]
    i++
  }

  if (i >= template.length || template[i] !== '[') {
    // No brackets - could be a simple variable like $count
    return { result: processFunction(funcName, [], ctx), endIndex: i }
  }

  // Parse arguments inside brackets
  i++ // skip opening [
  const args: string[] = []
  let currentArg = ''
  let depth = 1

  while (i < template.length && depth > 0) {
    const ch = template[i]

    if (ch === '[') {
      depth++
      currentArg += ch
    } else if (ch === ']') {
      depth--
      if (depth === 0) {
        args.push(currentArg)
        break
      }
      currentArg += ch
    } else if (ch === ',' && depth === 1) {
      args.push(currentArg)
      currentArg = ''
      // Skip whitespace after comma
      if (i + 1 < template.length && template[i + 1] === ' ') {
        i++
      }
    } else {
      currentArg += ch
    }
    i++
  }

  const result = processFunction(funcName, args, ctx)
  return { result, endIndex: i + 1 }
}

export function processTemplate(template: string, ctx: ParserContext): string {
  let output = ''
  let i = 0

  while (i < template.length) {
    const ch = template[i]

    // Field reference: {id: label} or {id-subid: label}
    if (ch === '{') {
      const closeBrace = template.indexOf('}', i)
      if (closeBrace !== -1) {
        const ref = template.substring(i + 1, closeBrace)
        output += resolveFieldRef(ref, ctx)
        i = closeBrace + 1
        continue
      }
    }

    // Function call: $funcName[args]
    if (ch === '$') {
      const { result, endIndex } = parseFunctionCall(template, i, ctx)
      output += result
      i = endIndex
      continue
    }

    output += ch
    i++
  }

  return output
}

export function useParser() {
  function buildFieldMap(mockFields: MockField[]): Map<string, string> {
    const map = new Map<string, string>()
    for (const field of mockFields) {
      map.set(field.id, field.value)
      // Also store by label for convenience
      map.set(field.label, field.value)
      // Store full "id: label" format
      map.set(`${field.id}: ${field.label}`, field.value)
    }
    return map
  }

  function generatePreview(
    codeBefore: string,
    repeatingCode: string,
    codeAfter: string,
    mockFields: MockField[],
    rowCount: number = 3
  ): string {
    const fields = buildFieldMap(mockFields)
    const vars = new Map<string, string>()

    let output = ''

    // Process header (code before)
    if (codeBefore) {
      const ctx: ParserContext = { fields, vars, rowIndex: 0 }
      output += processTemplate(codeBefore, ctx)
    }

    // Process repeating rows
    for (let row = 0; row < rowCount; row++) {
      const ctx: ParserContext = { fields, vars, rowIndex: row }
      output += processTemplate(repeatingCode, ctx)
    }

    // Process footer (code after)
    if (codeAfter) {
      const ctx: ParserContext = { fields, vars, rowIndex: rowCount }
      output += processTemplate(codeAfter, ctx)
    }

    return output
  }

  return { generatePreview, processTemplate }
}
