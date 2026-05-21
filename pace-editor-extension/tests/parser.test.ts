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
    const { tree } = parse('id={471: id}&#9;')
    expect(tree).toHaveLength(3)
    expect(tree[0]).toEqual({ kind: 'text', value: 'id=' })
    expect(tree[1]).toEqual({ kind: 'field', raw: '471: id' })
    expect(tree[2]).toEqual({ kind: 'text', value: '&#9;' })
  })

  it('parses functions without brackets', () => {
    const { tree } = parse('row $count done')
    expect(tree).toHaveLength(3)
    expect(tree[1]).toMatchObject({ kind: 'func', name: '$count', args: null })
  })

  it('parses functions with empty brackets', () => {
    const { tree } = parse('$tab[]')
    expect(tree).toEqual([{ kind: 'func', name: '$tab', args: [{ nodes: [] }] }])
  })

  it('parses multi-bracket function calls', () => {
    const { tree } = parse('$ifelse[a][b][c]')
    const fn = tree[0]
    if (fn.kind !== 'func') throw new Error('expected func')
    expect(fn.name).toBe('$ifelse')
    expect(fn.args).toHaveLength(3)
    expect(fn.args![0].nodes[0]).toEqual({ kind: 'text', value: 'a' })
    expect(fn.args![1].nodes[0]).toEqual({ kind: 'text', value: 'b' })
    expect(fn.args![2].nodes[0]).toEqual({ kind: 'text', value: 'c' })
  })

  it('parses nested function calls inside an argument', () => {
    const { tree } = parse('$if[$strlen[{471: id}] > 0][yes]')
    const outer = tree[0]
    if (outer.kind !== 'func') throw new Error('expected func')
    expect(outer.name).toBe('$if')
    expect(outer.args).toHaveLength(2)
    const inner = outer.args![0].nodes[0]
    expect(inner).toMatchObject({ kind: 'func', name: '$strlen' })
  })

  it('keeps commas as literal text inside arguments', () => {
    const { tree } = parse('$substr[hello][0,2]')
    const fn = tree[0]
    if (fn.kind !== 'func') throw new Error('expected func')
    expect(fn.args![1].nodes[0]).toEqual({ kind: 'text', value: '0,2' })
  })

  it('records diagnostics for unclosed braces', () => {
    const { diagnostics } = parse('{471: id')
    expect(diagnostics.hasErrors).toBe(true)
    expect(diagnostics.errors[0].message).toMatch(/Unclosed field/)
  })

  it('records diagnostics for unclosed function calls', () => {
    const { diagnostics } = parse('$if[a][b')
    expect(diagnostics.hasErrors).toBe(true)
    expect(diagnostics.errors[0].message).toMatch(/Unclosed function/)
  })

  it('treats lone $ as literal text', () => {
    const src = 'price: $5'
    const { tree } = parse(src)
    expect(serialize(tree)).toBe(src)
  })

  it('treats stray `]` outside any function as literal', () => {
    const src = 'value [maybe]'
    const { tree } = parse(src)
    expect(serialize(tree)).toBe(src)
  })
})
