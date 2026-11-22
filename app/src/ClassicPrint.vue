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

interface TextStream {
  parts: TextPart[]
  graphemes: number[]
  words: number[]
  length: number
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
  return { parts, graphemes, words, length }
}

function pointAt(stream: TextStream, offset: number): [Text, number] {
  let low = 0
  let high = stream.parts.length - 1
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (stream.parts[mid]!.end < offset) low = mid + 1
    else high = mid
  }
  const part = stream.parts[low]!
  return [part.node, offset - part.start]
}

function fragment(stream: TextStream, start: number, end: number): DocumentFragment {
  const range = document.createRange()
  const [startNode, startOffset] = pointAt(stream, start)
  const [endNode, endOffset] = pointAt(stream, end)
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range.cloneContents()
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

    function flow(stream: TextStream, selector: string, grow: boolean, firstPageOnly = false): boolean {
      let offset = 0
      let index = 0
      let emptyPages = 0
      while (offset < stream.length) {
        if (firstPageOnly && index > 0) return false
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
    if (!flow(sidebarStream, '.cv-sidebar', false, true)) {
      throw new Error('The left column is too long to fit on the first A4 page. Shorten it before printing.')
    }
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
      const leftFits = flow(sidebarStream, '.cv-sidebar', false, true)
      const rightFits = flow(mainStream, '.cv-main', false)
      if (!leftFits || !rightFits) {
        pages[pages.length - 1]!.querySelector('.cv-consent')!.remove()
        addPage()
        putFooter()
        clearColumns()
        if (!flow(sidebarStream, '.cv-sidebar', false, true) || !flow(mainStream, '.cv-main', false)) {
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
            schedule()
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
