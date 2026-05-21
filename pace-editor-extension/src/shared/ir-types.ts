// Intermediate representation for Pace template strings.
//
// A template is a sequence of IRNodes. Text nodes carry literal characters
// (including whitespace, indentation, newlines) verbatim. Field nodes
// reference Pace's field catalog. Func nodes are function calls with
// per-arg whitespace tracking so that serialize(parse(x)) === x for any
// template the parser accepts.

export type IRNode = TextNode | FieldNode | FuncNode

export interface TextNode {
  kind: 'text'
  value: string
}

export interface FieldNode {
  kind: 'field'
  // Raw content between the braces, eg. "34-445: Person: Sex" or "471: id".
  // Stored verbatim to guarantee round-trip identity even for unusual labels.
  raw: string
}

export interface FuncArg {
  // Whitespace between the preceding `,` (or `[`) and the first non-ws token.
  // Captured so that `$if[a, b,  c]` round-trips with the right spacing.
  prefix: string
  nodes: IRNode[]
}

export interface FuncNode {
  kind: 'func'
  // Function name including the leading `$`, eg. "$if", "$ifelse", "$count".
  name: string
  // null when the function was written without brackets (eg. `$count`).
  args: FuncArg[] | null
}

export type IRTree = IRNode[]

// A parser error carries a 1-based line and column so the side panel can
// jump the user to the offending position in the textarea.
export interface ParseError {
  message: string
  index: number
  line: number
  column: number
}

export class ParseDiagnostics {
  public readonly errors: ParseError[] = []
  push(message: string, index: number, line: number, column: number): void {
    this.errors.push({ message, index, line, column })
  }
  get hasErrors(): boolean {
    return this.errors.length > 0
  }
}
