import { describe, expect, it, vi } from 'vitest'
import { cloneDocument, exampleDocument, newId, parseDocument, safeUrl } from './model'

describe('CV data', () => {
  it('generates a secure v4 ID when randomUUID is unavailable', () => {
    const nativeCrypto = globalThis.crypto
    const fallbackCrypto = Object.create(nativeCrypto) as Crypto
    Object.defineProperty(fallbackCrypto, 'randomUUID', { configurable: true, value: undefined })
    Object.defineProperty(fallbackCrypto, 'getRandomValues', {
      configurable: true,
      value: nativeCrypto.getRandomValues.bind(nativeCrypto),
    })
    vi.stubGlobal('crypto', fallbackCrypto)

    try {
      expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('round-trips an edited document without losing image data', () => {
    const doc = exampleDocument()
    doc.photo = 'data:image/png;base64,aGVsbG8='
    doc.experience[0]!.description = 'Changed locally'
    expect(parseDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
    expect(cloneDocument(doc)).not.toBe(doc)
  })

  it('rejects unknown versions and unsafe photo data', () => {
    expect(() => parseDocument({ ...exampleDocument(), version: 99 })).toThrow()
    expect(() => parseDocument({ ...exampleDocument(), photo: 'https://example.com/image.png' })).toThrow()
  })

  it('accepts and preserves the timeline layout', () => {
    const doc = exampleDocument()
    doc.layout = 'timeline'
    expect(parseDocument(JSON.parse(JSON.stringify(doc))).layout).toBe('timeline')
  })

  it('migrates older documents and limits experience text size', () => {
    const doc = exampleDocument()
    const { experienceFontSize: _size, ...olderDocument } = doc
    expect(parseDocument(olderDocument).experienceFontSize).toBe(10.5)
    expect(parseDocument({ ...doc, experienceFontSize: 9.5 }).experienceFontSize).toBe(9.5)
    expect(() => parseDocument({ ...doc, experienceFontSize: 9 })).toThrow()
  })

  it('only accepts explicitly allowed link protocols', () => {
    expect(safeUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(safeUrl('mailto:alex@example.com')).toBe('mailto:alex@example.com')
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('/relative')).toBeUndefined()
  })
})
