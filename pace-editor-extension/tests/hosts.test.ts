import { describe, it, expect } from 'vitest'
import { normalizeHostInput } from '../src/shared/hosts'

describe('normalizeHostInput', () => {
  it('turns a bare hostname into a manifest match pattern', () => {
    expect(normalizeHostInput('pace-bp-stg.xsdirect.nl')).toBe(
      'https://pace-bp-stg.xsdirect.nl/*',
    )
  })

  it('accepts a full https:// pattern and ensures it ends with /*', () => {
    expect(normalizeHostInput('https://example.com')).toBe('https://example.com/*')
    expect(normalizeHostInput('https://example.com/')).toBe('https://example.com/*')
    expect(normalizeHostInput('https://example.com/*')).toBe('https://example.com/*')
  })

  it('rejects empty and obviously invalid input', () => {
    expect(normalizeHostInput('')).toBeNull()
    expect(normalizeHostInput('   ')).toBeNull()
    expect(normalizeHostInput('not a host')).toBeNull()
    expect(normalizeHostInput('localhost')).toBeNull()
  })
})
