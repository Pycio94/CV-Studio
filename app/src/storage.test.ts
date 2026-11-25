import { describe, expect, it } from 'vitest'
import { cloneDocument, exampleDocument } from './model'
import { createBackup, parseBackup, parseStoredRecords } from './storage'

describe('storage', () => {
  it('skips corrupted records without discarding healthy records', () => {
    const valid = exampleDocument()
    const record = { document: valid, original: cloneDocument(valid) }
    const result = parseStoredRecords([record, { document: { version: 99 } }, null])

    expect(result.records).toEqual([record])
    expect(result.corruptedCount).toBe(2)
  })

  it('round-trips backup wrappers and legacy raw documents', () => {
    const doc = exampleDocument()
    const original = cloneDocument(doc)
    doc.name = 'Edited'
    const backup = createBackup({ document: doc, original })

    expect(parseBackup(backup)).toEqual({ document: doc, original })
    expect(parseBackup(doc)).toEqual({ document: doc, original: doc })
  })
})
