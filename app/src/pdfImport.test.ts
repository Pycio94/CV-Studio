import { describe, expect, it } from 'vitest'
import { findColumnSplit } from './pdfImport'

describe('findColumnSplit', () => {
  it('rejects indented text that overlaps across a candidate split', () => {
    const items = Array.from({ length: 10 }, (_, index) => [
      { text: 'Main column text', x: 220, y: 100 + index * 30, width: 220, height: 10 },
      { text: 'Indented continuation', x: 320, y: 100 + index * 30, width: 200, height: 10 },
    ]).flat()
    expect(findColumnSplit(items, 595, 842)).toBeUndefined()
  })

  it('rejects same-row text fragments even when they have a gutter', () => {
    const items = Array.from({ length: 10 }, (_, index) => [
      { text: 'Main column label', x: 220, y: 100 + index * 30, width: 100, height: 10 },
      { text: 'Right-aligned detail', x: 400, y: 104.8 + index * 30, width: 80, height: 10 },
    ]).flat()
    expect(findColumnSplit(items, 595, 842)).toBeUndefined()
  })

  it('keeps imbalanced columns when few right-side items align with the left', () => {
    const leftColumn = Array.from({ length: 12 }, (_, index) => ({
      text: 'Left column item',
      x: 20,
      y: 100 + index * 50,
      width: 90,
      height: 10,
    }))
    const rightColumn = [
      ...Array.from({ length: 11 }, (_, index) => ({
        text: 'Aligned right column item',
        x: 220,
        y: 100 + index * 50,
        width: 180,
        height: 10,
      })),
      ...Array.from({ length: 89 }, (_, index) => ({
        text: 'Unaligned right column item',
        x: 220,
        y: 115 + index % 20,
        width: 180,
        height: 10,
      })),
    ]

    expect(findColumnSplit([...leftColumn, ...rightColumn], 595, 842)).toBeCloseTo(120)
  })

  it('recognizes independent columns with a physical gutter', () => {
    const items = Array.from({ length: 10 }, (_, index) => [
      { text: 'Left column', x: 20, y: 100 + index * 30, width: 90, height: 10 },
      { text: 'Right column', x: 220, y: 110 + index * 30, width: 180, height: 10 },
    ]).flat()

    expect(findColumnSplit(items, 595, 842)).toBeCloseTo(120)
  })
})
