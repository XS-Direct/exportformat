import { IRNode, IRTree, FuncNode } from './ir-types'

export function serialize(tree: IRTree): string {
  let out = ''
  for (const node of tree) out += serializeNode(node)
  return out
}

function serializeNode(node: IRNode): string {
  switch (node.kind) {
    case 'text':
      return node.value
    case 'field':
      return `{${node.raw}}`
    case 'func':
      return serializeFunc(node)
  }
}

function serializeFunc(node: FuncNode): string {
  if (node.args === null) return node.name
  const parts: string[] = []
  for (const arg of node.args) {
    parts.push(arg.prefix + serialize(arg.nodes))
  }
  return `${node.name}[${parts.join(',')}]`
}
