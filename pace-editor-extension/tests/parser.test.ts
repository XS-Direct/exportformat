import { describe, it, expect } from 'vitest'
import { parse } from '../src/shared/parser'
import { serialize } from '../src/shared/serializer'

describe('parser', () => {
  it('returns plain text unchanged', () => {
    const { tree, diagnostics } = parse('hello world')
    expect(diagnostics.hasErrors).toBe(false)
    expect(tree).toEqual([{ kind: 'text', value: 'hello world' }])
  })

  it('parses a single field reference', () => {
    const { tree } = parse('{471: id}')
    expect(tree).toEqual([{ kind: 'field', raw: '471: id' }])
  })

  it('parses field references mixed with text', () => {
    const { tree } = parse('id={471: id}\t')
    expect(tree).toHaveLength(3)
    expect(tree[0]).toEqual({ kind: 'text', value: 'id=' })
    expect(tree[1]).toEqual({ kind: 'field', raw: '471: id' })
    expect(tree[2]).toEqual({ kind: 'text', value: '\t' })
  })

  it('parses functions without brackets', () => {
    const { tree } = parse('row $count done')
    expect(tree).toHaveLength(3)
    expect(tree[1]).toMatchObject({ kind: 'func', name: '$count', args: null })
  })

  it('parses functions with empty brackets', () => {
    const { tree } = parse('$tab[]')
    expect(tree).toEqual([{ kind: 'func', name: '$tab', args: [{ prefix: '', nodes: [] }] }])
  })

  it('parses nested functions', () => {
    const { tree } = parse('$if[$strlen[{471: id}], yes, no]')
    expect(tree).toHaveLength(1)
    const fn = tree[0]
    if (fn.kind !== 'func') throw new Error('expected func')
    expect(fn.name).toBe('$if')
    expect(fn.args).toHaveLength(3)
    expect(fn.args![0].nodes[0]).toMatchObject({ kind: 'func', name: '$strlen' })
  })

  it('preserves whitespace after commas in arg list', () => {
    const src = '$if[a,   b,\n  c]'
    const { tree } = parse(src)
    const fn = tree[0]
    if (fn.kind !== 'func') throw new Error('expected func')
    expect(fn.args!.map((a) => a.prefix)).toEqual(['', '   ', '\n  '])
  })

  it('records diagnostics for unclosed braces', () => {
    const { diagnostics } = parse('{471: id')
    expect(diagnostics.hasErrors).toBe(true)
    expect(diagnostics.errors[0].message).toMatch(/Unclosed field/)
  })

  it('records diagnostics for unclosed function calls', () => {
    const { diagnostics } = parse('$if[a, b')
    expect(diagnostics.hasErrors).toBe(true)
    expect(diagnostics.errors[0].message).toMatch(/Unclosed function/)
  })

  it('treats lone $ as literal text', () => {
    const src = 'price: $5'
    const { tree } = parse(src)
    expect(serialize(tree)).toBe(src)
  })
})
