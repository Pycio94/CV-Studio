<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CvPreview from './CvPreview.vue'
import type { CvDocument } from './model'

const props = defineProps<{ doc: CvDocument }>()
const emit = defineEmits<{ status: [count: number, message: string] }>()
const source = ref<HTMLElement | null>(null)
const output = ref<HTMLElement | null>(null)
const maxPages = 200
let scheduled = 0
let resizeFrame = 0
let resizeObserver: ResizeObserver | undefined

interface TextPart {
  node: Text
  start: number
  end: number
}

interface TextSpan {
  start: number
  end: number
}

interface TextStream {
  parts: TextPart[]
  graphemes: number[]
  words: number[]
  headings: TextSpan[]
  keepTogether: TextSpan[]
  length: number
}

function spanForElement(parts: TextPart[], element: Element): TextSpan | undefined {
  let start: number | undefined
  let end = 0
  for (const part of parts) {
    if (element.contains(part.node)) {
      if (start === undefined) start = part.start
      end = part.end
    } else if (start !== undefined) {
      break
    }
  }
  return start !== undefined && end > start ? { start, end } : undefined
}

function makeStream(element: Element): TextStream {
  const parts: TextPart[] = []
  const graphemes = [0]
  const words = [0]
  const characterSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let length = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text
    const text = textNode.data
    if (!text.length) continue
    const start = length
    length += text.length
    parts.push({ node: textNode, start, end: length })
    for (const segment of characterSegmenter.segment(text)) {
      graphemes.push(start + segment.index + segment.segment.length)
    }
    for (const segment of wordSegmenter.segment(text)) {
      words.push(start + segment.index + segment.segment.length)
    }
  }

  const headings: TextSpan[] = []
  for (const el of element.querySelectorAll('h2')) {
    const span = spanForElement(parts, el)
    if (span) headings.push(span)
  }
  for (const entry of element.querySelectorAll('.experience-entry')) {
    const titleEl = entry.querySelector('.timeline-role-heading, h3')
    const metaEl = entry.querySelector('.experience-meta')
    const titleSpan = titleEl ? spanForElement(parts, titleEl) : undefined
    const metaSpan = metaEl ? spanForElement(parts, metaEl) : undefined
    if (titleSpan && metaSpan) {
      headings.push({ start: Math.min(titleSpan.start, metaSpan.start), end: Math.max(titleSpan.end, metaSpan.end) })
    } else if (titleSpan) {
      headings.push(titleSpan)
    }
  }

  const keepTogether: TextSpan[] = []
  for (const li of element.querySelectorAll('li')) {
    const span = spanForElement(parts, li)
    if (span && span.end - span.start <= 400) keepTogether.push(span)
  }
  for (const entry of element.querySelectorAll('.experience-entry')) {
    const span = spanForElement(parts, entry)
    if (span && span.end - span.start <= 800) keepTogether.push(span)
  }

  return { parts, graphemes, words, headings, keepTogether, length }
}

function pointAt(stream: TextStream, offset: number, preferNext = false): [Text, number] {
  let low = 0
  let high = stream.parts.length - 1
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const part = stream.parts[mid]!
    if (preferNext ? part.end <= offset : part.end < offset) low = mid + 1
    else high = mid
  }
  const part = stream.parts[low]!
  return [part.node, Math.max(0, Math.min(part.node.data.length, offset - part.start))]
}

function textBetween(stream: TextStream, start: number, end: number): string {
  if (end <= start || !stream.parts.length) return ''
  let result = ''
  for (const part of stream.parts) {
    if (part.end <= start) continue
    if (part.start >= end) break
    const sliceStart = Math.max(0, start - part.start)
    const sliceEnd = Math.min(part.node.data.length, end - part.start)
    result += part.node.data.slice(sliceStart, sliceEnd)
  }
  return result
}

function fragment(stream: TextStream, start: number, end: number): DocumentFragment {
  const range = document.createRange()
  const [startNode, startOffset] = pointAt(stream, start, true)
  const [endNode, endOffset] = pointAt(stream, end, false)
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  const cloned = range.cloneContents()
  for (const el of Array.from(
    cloned.querySelectorAll('h2, h3, p, li, ul, section, .experience-entry, .timeline-role-heading'),
  ).reverse()) {
    if (!el.textContent?.trim() && !el.querySelector('img')) el.remove()
  }
  return cloned
}

function lastAtMost(values: number[], value: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (values[mid]! <= value) low = mid + 1
    else high = mid
  }
  return low - 1
}

function adjustSemanticBreak(stream: TextStream, start: number, best: number): number {
  let snapped = best
  for (const unit of stream.keepTogether) {
    if (unit.start > start && unit.start < snapped && snapped < unit.end) {
      snapped = unit.start
    }
  }
  let changed = true
  while (changed) {
    changed = false
    for (const heading of stream.headings) {
      if (heading.start > start && heading.start < snapped) {
        if (snapped <= heading.end || !textBetween(stream, heading.end, snapped).trim()) {
          snapped = heading.start
          changed = true
        }
      }
    }
  }
  return snapped > start ? snapped : best
}

function fitFragment(area: HTMLElement, stream: TextStream, start: number): number {
  let low = lastAtMost(stream.graphemes, start) + 1
  let high = stream.graphemes.length - 1
  let best = start
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const end = stream.graphemes[mid]!
    area.replaceChildren(fragment(stream, start, end))
    if (area.scrollHeight <= area.clientHeight) {
      best = end
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (best < stream.length) {
    const word = stream.words[lastAtMost(stream.words, best)] ?? start
    if (word > start) best = word
    best = adjustSemanticBreak(stream, start, best)
  }
  area.replaceChildren(...(best > start ? [fragment(stream, start, best)] : []))
  return best
}

function paginate() {
  if (!source.value || !output.value) return
  const original = source.value.querySelector('.cv')
  const header = original?.querySelector('.cv-header')
  const sidebar = original?.querySelector('.cv-sidebar')
  const main = original?.querySelector('.cv-main')
  const footer = original?.querySelector('.cv-consent')
  if (!header || !sidebar || !main) return
  const target = output.value
  const savedScale = target.style.getPropertyValue('--preview-scale')
  target.style.setProperty('--preview-scale', '1')
  target.replaceChildren()

  try {
    const sidebarStream = makeStream(sidebar)
    const mainStream = makeStream(main)
    const pages: HTMLElement[] = []

    function addPage() {
      if (pages.length >= maxPages) throw new Error(`The CV exceeds ${maxPages} pages. Shorten its content before printing.`)
      const page = document.createElement('article')
      page.className = `cv cv--${props.doc.layout} classic-page`
      page.setAttribute('aria-label', `CV preview page ${pages.length + 1}`)
      page.style.setProperty('--experience-size', `${props.doc.experienceFontSize}pt`)
      if (!pages.length) page.append(header!.cloneNode(true))
      const body = document.createElement('div')
      body.className = 'cv-content'
      const left = document.createElement('aside')
      left.className = 'cv-sidebar'
      const right = document.createElement('main')
      right.className = 'cv-main'
      body.append(left, right)
      page.append(body)
      const sheet = document.createElement('div')
      sheet.className = 'classic-sheet'
      sheet.append(page)
      target.append(sheet)
      pages.push(page)
      const pageHeader = page.querySelector<HTMLElement>('.cv-header')
      if (pageHeader && pageHeader.scrollHeight >= page.clientHeight) {
        throw new Error('The name or title is too long to fit on an A4 page. Shorten it before printing.')
      }
    }

    function flow(stream: TextStream, selector: string, grow: boolean): boolean {
      let offset = 0
      let index = 0
      let emptyPages = 0
      while (offset < stream.length) {
        if (index >= pages.length) {
          if (!grow) return false
          addPage()
        }
        const area = pages[index]!.querySelector<HTMLElement>(selector)!
        const next = fitFragment(area, stream, offset)
        if (next === offset) {
          emptyPages++
          if (emptyPages > 1 && grow) {
            throw new Error('A section cannot fit on an A4 page. Shorten its content before printing.')
          }
        } else {
          offset = next
          emptyPages = 0
        }
        index++
      }
      return true
    }

    function clearColumns() {
      for (const page of pages) {
        page.querySelector('.cv-sidebar')!.replaceChildren()
        page.querySelector('.cv-main')!.replaceChildren()
      }
    }

    addPage()
    flow(sidebarStream, '.cv-sidebar', true)
    flow(mainStream, '.cv-main', true)

    if (footer) {
      function putFooter() {
        const last = pages[pages.length - 1]!
        const copy = footer!.cloneNode(true) as HTMLElement
        last.append(copy)
        if (copy.scrollHeight >= last.clientHeight) {
          throw new Error('The consent statement is too long to fit on an A4 page. Shorten it before printing.')
        }
      }
      putFooter()
      clearColumns()
      const leftFits = flow(sidebarStream, '.cv-sidebar', false)
      const rightFits = flow(mainStream, '.cv-main', false)
      if (!leftFits || !rightFits) {
        pages[pages.length - 1]!.querySelector('.cv-consent')!.remove()
        addPage()
        putFooter()
        clearColumns()
        if (!flow(sidebarStream, '.cv-sidebar', false) || !flow(mainStream, '.cv-main', false)) {
          throw new Error('The CV could not be paginated safely. Shorten its content before printing.')
        }
      }
    }
    emit('status', pages.length, '')
  } catch (cause) {
    target.replaceChildren()
    const warning = document.createElement('p')
    const message = cause instanceof Error ? cause.message : String(cause)
    warning.className = 'pagination-print-error'
    warning.textContent = message
    target.append(warning)
    emit('status', 0, message)
  } finally {
    if (savedScale) target.style.setProperty('--preview-scale', savedScale)
    else target.style.removeProperty('--preview-scale')
  }
}

function schedule() {
  cancelAnimationFrame(scheduled)
  scheduled = requestAnimationFrame(paginate)
}

watch(() => props.doc, schedule, { deep: true, flush: 'post' })
onMounted(() => {
  const container = output.value?.parentElement
  if (container && output.value) {
    resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) {
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => {
          if (!output.value) return
          const scale = String(Math.min(1, width / (210 * 96 / 25.4)))
          if (output.value.style.getPropertyValue('--preview-scale') !== scale) {
            output.value.style.setProperty('--preview-scale', scale)
          }
        })
      }
    })
    resizeObserver.observe(container)
  }
  schedule()
  window.addEventListener('beforeprint', paginate)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(scheduled)
  cancelAnimationFrame(resizeFrame)
  resizeObserver?.disconnect()
  window.removeEventListener('beforeprint', paginate)
})
defineExpose({ paginate })
</script>

<template>
  <!-- Hidden source CV used to measure and split text across A4 pages. -->
  <div ref="source" class="classic-print-source" aria-hidden="true">
    <CvPreview :doc="doc" />
  </div>

  <!-- Visible paginated preview and the final browser print output. -->
  <div ref="output" class="classic-pages"></div>
</template>
