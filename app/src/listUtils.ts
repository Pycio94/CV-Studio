import type { Experience, Item } from './model'

export function moveEntry<T>(items: readonly T[], index: number, offset: number): T[] {
  const target = index + offset
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items.slice()
  }
  const copy = items.slice()
  const [entry] = copy.splice(index, 1)
  if (entry !== undefined) copy.splice(target, 0, entry)
  return copy
}

export function removeEntry<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, currentIndex) => currentIndex !== index)
}

export function hasItems(items: readonly Item[]): boolean {
  return items.some(item => item.label.trim() || item.detail.trim())
}

export function nonEmptyItems(items: readonly Item[]): Item[] {
  return items.filter(item => item.label.trim() || item.detail.trim())
}

export function formatItem(entry: Pick<Item, 'label' | 'detail'>): string {
  const label = entry.label.trim()
  const detail = entry.detail.trim()
  if (label && detail) return `${label} - ${detail}`
  return label || detail
}

export function hasExperienceContent(entry: Experience): boolean {
  return Boolean(
    entry.title.trim()
    || entry.company.trim()
    || entry.dates.trim()
    || entry.description.trim()
    || hasItems(entry.bullets),
  )
}

export function safeFilename(name: string, fallback = 'cv'): string {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || fallback
}
