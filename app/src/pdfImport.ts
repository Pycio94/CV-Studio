import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parsePdfText } from './pdfParser'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const maxPages = 100

interface PositionedText {
  text: string
  x: number
  y: number
  width: number
  height: number
}

interface PdfTextItem {
  str: string
  dir: string
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object'
    && item !== null
    && 'str' in item
    && typeof item.str === 'string'
    && 'dir' in item
    && typeof item.dir === 'string'
    && 'transform' in item
    && Array.isArray(item.transform)
    && 'width' in item
    && typeof item.width === 'number'
    && 'height' in item
    && typeof item.height === 'number'
    && 'fontName' in item
    && typeof item.fontName === 'string'
    && 'hasEOL' in item
    && typeof item.hasEOL === 'boolean'
}

function combineRow(items: PositionedText[]): string {
  let text = ''
  let right = 0
  for (const item of items) {
    const part = item.text.trim()
    if (!part) continue
    const gap = item.x - right
    if (text && gap > Math.max(36, item.height * 3)) {
      text += '\n'
    } else if (text && gap > Math.max(1.5, item.height * 0.18) && !/[,.;:!?%)\]}]$/.test(text)) {
      text += ' '
    }
    text += part
    right = item.x + item.width
  }
  return text.trim()
}

export function findColumnSplit(items: PositionedText[], pageWidth: number, pageHeight: number): number | undefined {
  const candidates = items
    .filter(item => item.width <= pageWidth * 0.45)
    .sort((a, b) => a.x - b.x)
  const byX = items.slice().sort((a, b) => a.x - b.x)
  const prefixMaxRight: number[] = []
  const prefixMinY: number[] = []
  const prefixMaxY: number[] = []
  const suffixMinY: number[] = []
  const suffixMaxY: number[] = []
  for (let index = 0; index < candidates.length; index++) {
    const item = candidates[index]!
    prefixMaxRight[index] = Math.max(index ? prefixMaxRight[index - 1]! : Number.NEGATIVE_INFINITY, item.x + item.width)
  }
  for (let index = 0; index < byX.length; index++) {
    const item = byX[index]!
    prefixMinY[index] = Math.min(index ? prefixMinY[index - 1]! : item.y, item.y)
    prefixMaxY[index] = Math.max(index ? prefixMaxY[index - 1]! : item.y, item.y)
  }
  for (let index = byX.length - 1; index >= 0; index--) {
    const item = byX[index]!
    suffixMinY[index] = Math.min(index < byX.length - 1 ? suffixMinY[index + 1]! : item.y, item.y)
    suffixMaxY[index] = Math.max(index < byX.length - 1 ? suffixMaxY[index + 1]! : item.y, item.y)
  }
  const minimumCount = Math.max(3, Math.ceil(items.length * 0.1))
  let best: { split: number; score: number } | undefined
  let leftCount = 0

  for (let index = 1; index < candidates.length; index++) {
    const previous = candidates[index - 1]!
    const next = candidates[index]!
    const gap = next.x - previous.x
    if (gap < Math.max(42, pageWidth * 0.08)) continue
    const physicalGutter = next.x - prefixMaxRight[index - 1]!
    if (physicalGutter < Math.max(1, pageWidth * 0.01)) continue

    const split = (previous.x + next.x) / 2
    while (leftCount < byX.length && byX[leftCount]!.x < split) leftCount++
    const rightCount = byX.length - leftCount
    if (leftCount < minimumCount || rightCount < minimumCount) continue
    const leftSpan = prefixMaxY[leftCount - 1]! - prefixMinY[leftCount - 1]!
    const rightSpan = suffixMaxY[leftCount]! - suffixMinY[leftCount]!
    if (Math.min(leftSpan, rightSpan) < pageHeight * 0.1) continue

    const leftY = byX.slice(0, leftCount).map(item => item.y).sort((a, b) => a - b)
    const rightY = byX.slice(leftCount).map(item => item.y).sort((a, b) => a - b)
    let leftYIndex = 0
    let alignedRightItems = 0
    for (const y of rightY) {
      while (leftYIndex < leftY.length && leftY[leftYIndex]! < y - 5) leftYIndex++
      if (leftYIndex < leftY.length && leftY[leftYIndex]! <= y + 5) alignedRightItems++
    }
    // Same-row fragments in one column can mimic a separate right column.
    if (alignedRightItems >= rightCount * 0.9) continue

    const score = gap * Math.min(leftCount, rightCount) / items.length
    if (!best || score > best.score) best = { split, score }
  }
  return best?.split
}

function columnLines(items: PositionedText[]): string[] {
  const positioned = items.slice().sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: { y: number; height: number; items: PositionedText[] }[] = []
  for (const item of positioned) {
    const row = rows[rows.length - 1]
    const tolerance = Math.max(2, Math.min(5, item.height * 0.3))
    if (row && Math.abs(row.y - item.y) <= tolerance) {
      row.items.push(item)
      row.height = Math.max(row.height, item.height)
    } else {
      rows.push({ y: item.y, height: item.height, items: [item] })
    }
  }

  const lines: string[] = []
  let previous: (typeof rows)[number] | undefined
  for (const row of rows) {
    if (previous && previous.y - row.y > Math.max(12, previous.height * 1.6)) lines.push('')
    const line = combineRow(row.items.sort((a, b) => a.x - b.x))
    if (line) lines.push(line)
    previous = row
  }
  return lines
}

function pageColumns(items: PdfTextItem[], pageWidth: number, pageHeight: number): string[][] {
  const positioned: PositionedText[] = items.map(item => ({
    text: item.str,
    x: item.transform[4] ?? 0,
    y: item.transform[5] ?? 0,
    width: item.width,
    height: item.height,
  }))
  const split = findColumnSplit(positioned, pageWidth, pageHeight)
  if (split === undefined) return [columnLines(positioned)]
  return [
    columnLines(positioned.filter(item => item.x < split)),
    columnLines(positioned.filter(item => item.x >= split)),
  ]
}

export async function importPdf(file: File) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const pdf = await task.promise
    if (pdf.numPages > maxPages) {
      throw new Error(`This PDF has more than ${maxPages} pages. Split it before importing.`)
    }

    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = content.items.filter(isPdfTextItem).filter(item => item.str.trim())
      const { width, height } = page.getViewport({ scale: 1 })
      pages.push(pageColumns(items, width, height).map(column => column.join('\n')).join('\f'))
    }

    const text = pages.join('\v')
    if (!text.trim()) {
      throw new Error('No selectable text found. Scanned PDFs need OCR and cannot be imported yet.')
    }
    return parsePdfText(text, file.name)
  } finally {
    await task.destroy()
  }
}
