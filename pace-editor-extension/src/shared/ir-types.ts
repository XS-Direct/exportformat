// Intermediate representation for Pace template strings.
//
// Pace's surface syntax is:
//
//   field    := '{' raw '}'                          // raw never contains '{' or '}'
//   funcCall := '$' name ('[' template ']')+         // one or more bracket pairs
//   text     := anything else
//
// Commas are literal text — function arguments are separated by adjacent
// bracket pairs, not commas. The IR mirrors that shape exactly so
// serialize(parse(x)) === x for every template the parser accepts.

export type IRNode = TextNode | FieldNode | FuncNode

export interface TextNode {
  kind: 'text'
  value: string
}

export interface FieldNode {
  kind: 'field'
  // Raw content between the braces, eg. "34-445: Person: Sex", "471: id",
  // or "var:count" for variable references. Stored verbatim.
  raw: string
}

export interface FuncArg {
  // The template inside one bracket pair. Parsed recursively into IR nodes.
  nodes: IRNode[]
}

export interface FuncNode {
  kind: 'func'
  // Function name including the leading `$`, eg. "$if", "$ifelse", "$var".
  name: string
  // null means the function appeared without any brackets (eg. `$count` as
  // a standalone token); an empty array would mean `$name` followed by no
  // brackets either, which we encode the same way as null for clarity.
  args: FuncArg[] | null
}

export type IRTree = IRNode[]

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
