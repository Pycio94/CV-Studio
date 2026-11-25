import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { findColumnSplit, type PositionedText } from './pdfLayout'
import { parsePdfText } from './pdfParser'

export { findColumnSplit }

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const maxPages = 100

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
