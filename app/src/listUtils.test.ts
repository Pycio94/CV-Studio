import { describe, expect, it } from 'vitest'
import { formatItem, hasExperienceContent, moveEntry, removeEntry, safeFilename } from './listUtils'
import { newExperience } from './model'

describe('listUtils', () => {
  it('formats items without dangling separators', () => {
    expect(formatItem({ label: 'English', detail: 'Fluent' })).toBe('English - Fluent')
    expect(formatItem({ label: 'Vue', detail: '   ' })).toBe('Vue')
    expect(formatItem({ label: '   ', detail: 'Fluent' })).toBe('Fluent')
    expect(formatItem({ label: '', detail: '' })).toBe('')
  })

  it('moves and removes entries immutably', () => {
    const source = ['a', 'b', 'c']
    expect(moveEntry(source, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveEntry(source, 0, -1)).toEqual(['a', 'b', 'c'])
    expect(removeEntry(source, 1)).toEqual(['a', 'c'])
    expect(source).toEqual(['a', 'b', 'c'])
  })

  it('detects blank and whitespace-only experience entries', () => {
    const empty = newExperience()
    empty.title = '   '
    empty.description = '\n  '
    expect(hasExperienceContent(empty)).toBe(false)

    empty.company = 'Acme'
    expect(hasExperienceContent(empty)).toBe(true)
  })

  it('preserves Unicode letters in exported filenames', () => {
    expect(safeFilename('Example CV')).toBe('Example-CV')
    expect(safeFilename('Jan Kowalski – Życiorys')).toBe('Jan-Kowalski-Życiorys')
    expect(safeFilename('   ...   ')).toBe('cv')
  })
})
