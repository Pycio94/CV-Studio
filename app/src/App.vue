<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CvPreview from './CvPreview.vue'
import ClassicPrint from './ClassicPrint.vue'
import ItemEditor from './ItemEditor.vue'
import { importLegacy } from './legacy'
import {
  cloneDocument, exampleDocument, newContact, newExperience, newId,
  safeUrl, type CvDocument, type HeadingKey,
} from './model'
import {
  createBackup, deleteRecord, loadRecords, parseBackup, saveRecord, type CvRecord,
} from './storage'

const records = ref<CvRecord[]>([])
const currentId = ref('')
const active = computed(() => records.value.find(record => record.document.id === currentId.value))
const status = ref('Loading local CVs...')
const error = ref('')
const ready = ref(false)
const busy = ref(false)
const pdfImporting = ref(false)
const pdfHelp = ref(false)
const printMeasure = ref<HTMLElement | null>(null)
const classicPrint = ref<InstanceType<typeof ClassicPrint> | null>(null)
const exceedsPage = ref(false)
const paginationError = ref('')
const classicPageCount = ref(1)
let timer: ReturnType<typeof setTimeout> | undefined
let saveChain: Promise<void> = Promise.resolve()
let revision = 0
let storageReadable = true

const headingLabels: Record<HeadingKey, string> = {
  contact: 'Contact heading',
  summary: 'Profile heading',
  experience: 'Experience heading',
  education: 'Education heading',
  skills: 'Skills heading',
  languages: 'Languages heading',
}

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  if (busy.value || status.value !== 'Saved locally') {
    event.preventDefault()
    event.returnValue = ''
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function isPagedLayout(layout: CvDocument['layout'] | undefined): boolean {
  return layout === 'classic' || layout === 'timeline'
}

function snapshot(record: CvRecord): CvRecord {
  return { document: cloneDocument(record.document), original: cloneDocument(record.original) }
}

async function saveCurrent(): Promise<boolean> {
  if (timer) clearTimeout(timer)
  timer = undefined
  const record = active.value
  if (!record) return true
  if (!storageReadable) {
    error.value = 'Stored CVs could not be read. Your draft is only in memory. Export it before closing this page.'
    status.value = 'Not saved'
    return false
  }
  let copy: CvRecord
  try {
    copy = snapshot(record)
  } catch (cause) {
    error.value = `Cannot save: ${message(cause)}`
    status.value = 'Not saved'
    return false
  }
  const savedRevision = revision
  status.value = 'Saving...'
  const task = saveChain.catch(() => undefined).then(() => saveRecord(copy))
  saveChain = task
  try {
    await task
    if (revision === savedRevision) {
      status.value = 'Saved locally'
      error.value = ''
    }
    return true
  } catch (cause) {
    status.value = 'Not saved'
    error.value = `Local save failed: ${message(cause)}. Export your draft before closing this page.`
    return false
  }
}

async function flushCurrent(): Promise<boolean> {
  let savedRevision: number
  do {
    savedRevision = revision
    if (!(await saveCurrent())) return false
  } while (savedRevision !== revision)
  return true
}

watch(active, () => {
  if (!ready.value || !active.value) return
  revision++
  status.value = 'Unsaved changes'
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void saveCurrent() }, 500)
}, { deep: true, flush: 'sync' })

onMounted(async () => {
  window.addEventListener('beforeunload', warnBeforeLeaving)
  try {
    records.value = await loadRecords()
    if (!records.value.length) {
      const doc = exampleDocument()
      records.value = [{ document: doc, original: cloneDocument(doc) }]
      await saveRecord(snapshot(records.value[0]!))
    }
    currentId.value = records.value[0]!.document.id
    status.value = 'Saved locally'
  } catch (cause) {
    storageReadable = false
    const doc = exampleDocument()
    records.value = [{ document: doc, original: cloneDocument(doc) }]
    currentId.value = doc.id
    status.value = 'Not saved'
    error.value = `Could not read local CVs: ${message(cause)}. Existing data was not changed. This draft is only in memory; export it before closing.`
  }
  ready.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeLeaving)
  if (timer) clearTimeout(timer)
})

async function switchDocument(event: Event) {
  const select = event.target as HTMLSelectElement
  const nextId = select.value
  busy.value = true
  try {
    if (!(await flushCurrent())) {
      select.value = currentId.value
      return
    }
    currentId.value = nextId
  } finally {
    busy.value = false
  }
}

async function addDocument(doc: CvDocument, original: CvDocument = doc) {
  busy.value = true
  try {
    if (!(await flushCurrent())) return
    const copy = cloneDocument(doc)
    copy.id = newId()
    const originalCopy = cloneDocument(original)
    originalCopy.id = copy.id
    const record = { document: copy, original: originalCopy }
    await saveRecord(snapshot(record))
    records.value.push(record)
    currentId.value = copy.id
    error.value = ''
  } catch (cause) {
    error.value = `Could not add CV: ${message(cause)}`
  } finally {
    busy.value = false
  }
}

function createDocument() {
  const doc = exampleDocument()
  doc.documentName = 'Untitled CV'
  doc.name = ''
  doc.title = ''
  doc.summary = ''
  doc.contacts = []
  doc.experience = []
  doc.education = []
  doc.skills = []
  doc.languages = []
  void addDocument(doc)
}

function duplicateDocument() {
  if (!active.value) return
  const doc = cloneDocument(active.value.document)
  doc.documentName = `${doc.documentName || 'CV'} copy`
  void addDocument(doc)
}

async function removeDocument() {
  const record = active.value
  if (!record || !window.confirm(`Delete "${record.document.documentName || 'this CV'}"? This cannot be undone.`)) return
  busy.value = true
  try {
    if (!(await flushCurrent())) return
    await deleteRecord(record.document.id)
    records.value = records.value.filter(item => item.document.id !== record.document.id)
    if (!records.value.length) {
      const doc = exampleDocument()
      const replacement = { document: doc, original: cloneDocument(doc) }
      await saveRecord(snapshot(replacement))
      records.value = [replacement]
    }
    currentId.value = records.value[0]!.document.id
  } catch (cause) {
    error.value = `Could not delete CV: ${message(cause)}`
  } finally {
    busy.value = false
  }
}

function resetDocument() {
  if (!active.value || !window.confirm('Reset this CV to its original imported or created state? Current changes will be lost.')) return
  active.value.document = cloneDocument(active.value.original)
}

function removeEntry<T>(items: T[], index: number, label: string) {
  if (window.confirm(`Remove this ${label}?`)) items.splice(index, 1)
}

function moveEntry<T>(items: T[], index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= items.length) return
  const entry = items[index]
  if (!entry) return
  items.splice(index, 1)
  items.splice(target, 0, entry)
}

async function importFile(event: Event, kind: 'json' | 'legacy' | 'pdf') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 5_000_000) {
    error.value = 'Import file must be 5 MB or smaller.'
    return
  }
  try {
    if (window.confirm('Import this CV as a new document? Existing CVs will be kept.')) {
      if (kind === 'json') {
        const contents = await file.text()
        const backup = parseBackup(JSON.parse(contents))
        await addDocument(backup.document, backup.original)
      } else if (kind === 'pdf') {
        busy.value = true
        pdfImporting.value = true
        error.value = ''
        try {
          const { importPdf } = await import('./pdfImport')
          const doc = await importPdf(file)
          pdfImporting.value = false
          await addDocument(doc)
        } finally {
          pdfImporting.value = false
          busy.value = false
        }
      } else {
        const contents = await file.text()
        const doc = importLegacy(contents)
        await addDocument(doc)
      }
    }
  } catch (cause) {
    error.value = `Import failed: ${message(cause)}. Existing CVs were not changed.`
  }
}

function exportDocument() {
  if (!active.value) return
  try {
    const data = JSON.stringify(createBackup(snapshot(active.value)), null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${(active.value.document.documentName || 'cv').replace(/[^\w-]+/g, '-')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) {
    error.value = `Export failed: ${message(cause)}`
  }
}

async function uploadPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !active.value) return
  const targetId = active.value.document.id
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
    error.value = 'Choose a PNG, JPEG, or WebP image smaller than 2 MB.'
    return
  }
  try {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image.'))
      reader.readAsDataURL(file)
    })
    if (active.value?.document.id !== targetId) {
      throw new Error('The selected CV changed before the photo finished loading; select the photo again.')
    }
    active.value.document.photo = data
    error.value = ''
  } catch (cause) {
    error.value = `Photo could not be loaded: ${message(cause)}`
  }
}

async function printCv(pdf: boolean) {
  await nextTick()
  classicPrint.value?.paginate()
  if (paginationError.value) {
    error.value = paginationError.value
    return
  }
  pdfHelp.value = pdf
  if (pdf) {
    const margins = isPagedLayout(active.value?.document.layout) ? ' Set margins to None for edge-to-edge output.' : ''
    window.alert(`In the print dialog, choose “Save as PDF” or your system PDF printer. Use A4, portrait, and 100% scale.${margins}`)
  }
  window.print()
}

function updatePageWarning() {
  if (isPagedLayout(active.value?.document.layout)) {
    exceedsPage.value = classicPageCount.value > 1
    return
  }
  const cv = printMeasure.value?.querySelector('.cv')
  if (!cv) return
  exceedsPage.value = cv.getBoundingClientRect().height > 277 * 96 / 25.4
}

watch(active, () => {
  requestAnimationFrame(updatePageWarning)
}, { deep: true })

watch(() => active.value?.document.layout, () => {
  paginationError.value = ''
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header no-print">
      <div>
        <p class="eyebrow">LOCAL-FIRST CV EDITOR</p>
        <h1>CV Studio</h1>
      </div>
      <div class="header-actions">
        <button type="button" :disabled="!!paginationError" @click="printCv(false)">Print</button>
        <button type="button" class="primary" :disabled="!!paginationError" @click="printCv(true)">Save as PDF</button>
      </div>
    </header>
    <div v-if="error" class="alert no-print" role="alert">{{ error }}</div>
    <div v-if="active" class="workspace">
      <div class="editor no-print">
        <fieldset :disabled="busy" class="editor-fields">
        <div class="editor-heading">
          <div><h2>Your CV</h2><p>Edit the fields below to update the preview.</p></div>
          <span class="save-status" role="status">{{ pdfImporting ? 'Importing PDF...' : status }}</span>
        </div>
        <label>Choose CV
          <select :value="currentId" @change="switchDocument">
            <option v-for="record in records" :key="record.document.id" :value="record.document.id">
              {{ record.document.documentName || 'Untitled CV' }}
            </option>
          </select>
        </label>
        <div class="button-row">
          <button type="button" @click="createDocument">New CV</button>
          <button type="button" @click="duplicateDocument">Duplicate</button>
          <button type="button" class="danger" @click="removeDocument">Delete CV</button>
        </div>
        <div class="import-callout">
          <strong>Start with your existing CV</strong>
          <p>Import HTML or a text-based PDF locally. Scanned PDFs and embedded photos are not imported.</p>
          <label>Choose existing CV PDF <input type="file" accept=".pdf,application/pdf" @change="importFile($event, 'pdf')"></label>
          <label>Choose original CV HTML <input type="file" accept=".html,.htm,text/html" @change="importFile($event, 'legacy')"></label>
        </div>
        <details class="toolbox">
          <summary>Import, backup and reset</summary>
          <p>Export keeps the edited CV and its reset baseline, including the original imported content.</p>
          <p>Import that JSON backup on another computer to continue editing. Data otherwise stays in this browser.</p>
          <label class="file-label">Import JSON backup <input type="file" accept=".json,application/json" @change="importFile($event, 'json')"></label>
          <div class="button-row">
            <button type="button" @click="exportDocument">Export JSON</button>
            <button type="button" @click="resetDocument">Reset CV</button>
          </div>
          <p>Import the original <code>index.html</code> from your CV folder. The original photo is not imported automatically.</p>
        </details>

        <details open>
          <summary>Profile</summary>
          <label>CV name <input v-model="active.document.documentName"></label>
          <label>Full name <input v-model="active.document.name"></label>
          <label>Professional title <input v-model="active.document.title"></label>
          <label>Profile summary <textarea v-model="active.document.summary" rows="3"></textarea></label>
          <label>Photo (PNG, JPEG or WebP; maximum 2 MB) <input type="file" accept="image/png,image/jpeg,image/webp" @change="uploadPhoto"></label>
          <button v-if="active.document.photo" type="button" @click="active.document.photo = ''">Remove photo</button>
        </details>
        <details>
          <summary>Contact details</summary>
          <div v-for="(contact, index) in active.document.contacts" :key="contact.id" class="item-card">
            <div class="item-controls">
              <strong>Contact {{ index + 1 }}</strong>
              <button type="button" :disabled="index === 0" :aria-label="`Move contact ${index + 1} up`" @click="moveEntry(active.document.contacts, index, -1)">Up</button>
              <button type="button" :disabled="index === active.document.contacts.length - 1" :aria-label="`Move contact ${index + 1} down`" @click="moveEntry(active.document.contacts, index, 1)">Down</button>
              <button type="button" class="danger" :aria-label="`Remove contact ${index + 1}`" @click="removeEntry(active.document.contacts, index, 'contact')">Remove</button>
            </div>
            <label>Label <input v-model="contact.label"></label>
            <label>Value <input v-model="contact.value"></label>
            <label>Link (optional) <input v-model="contact.url" placeholder="https://, mailto: or tel:"></label>
            <p v-if="contact.url && !safeUrl(contact.url)" class="field-error">Use a valid http, https, mailto, or tel link.</p>
          </div>
          <button type="button" @click="active.document.contacts.push(newContact())">+ Add contact</button>
        </details>
        <details>
          <summary>Experience</summary>
          <label>Experience text size
            <select v-model.number="active.document.experienceFontSize">
              <option :value="10.5">Standard (10.5 pt)</option>
              <option :value="10">Compact (10 pt)</option>
              <option :value="9.5">Small (9.5 pt)</option>
            </select>
          </label>
          <div v-for="(entry, index) in active.document.experience" :key="entry.id" class="item-card">
            <div class="item-controls">
              <strong>Role {{ index + 1 }}</strong>
              <button type="button" :disabled="index === 0" :aria-label="`Move role ${index + 1} up`" @click="moveEntry(active.document.experience, index, -1)">Up</button>
              <button type="button" :disabled="index === active.document.experience.length - 1" :aria-label="`Move role ${index + 1} down`" @click="moveEntry(active.document.experience, index, 1)">Down</button>
              <button type="button" class="danger" :aria-label="`Remove role ${index + 1}`" @click="removeEntry(active.document.experience, index, 'role')">Remove</button>
            </div>
            <label>Job title <input v-model="entry.title"></label>
            <label>Company <input v-model="entry.company"></label>
            <label>Dates <input v-model="entry.dates"></label>
            <label>Description <textarea v-model="entry.description" rows="3"></textarea></label>
            <ItemEditor :items="entry.bullets" label="Bullet" detail-label="Additional detail" />
          </div>
          <button type="button" @click="active.document.experience.push(newExperience())">+ Add experience</button>
        </details>
        <details><summary>Education</summary><ItemEditor :items="active.document.education" label="Education" detail-label="Institution and dates" /></details>
        <details><summary>Skills</summary><ItemEditor :items="active.document.skills" label="Skill" detail-label="Detail" /></details>
        <details><summary>Languages</summary><ItemEditor :items="active.document.languages" label="Language" detail-label="Proficiency" /></details>
        <details>
          <summary>Section headings and consent</summary>
          <label v-for="(label, key) in headingLabels" :key="key">{{ label }} <input v-model="active.document.headings[key]"></label>
          <label class="check-label"><input v-model="active.document.showConsent" type="checkbox"> Include consent statement</label>
          <label>Consent statement <textarea v-model="active.document.consent" rows="4"></textarea></label>
        </details>
        </fieldset>
      </div>
      <div class="preview-panel">
        <div class="preview-toolbar no-print">
          <div><h2>Preview</h2><p>Classic and Timeline show A4 pages in two columns; ATS uses a single column.</p></div>
          <label>Layout
            <select v-model="active.document.layout">
              <option value="classic">Classic</option>
              <option value="ats">ATS-friendly</option>
              <option value="timeline">Timeline</option>
            </select>
          </label>
        </div>
        <p v-if="exceedsPage" class="page-warning no-print">Your CV may span multiple A4 pages. Check browser print preview.</p>
        <p v-if="paginationError" class="alert no-print" role="alert">{{ paginationError }}</p>
        <p v-if="pdfHelp" class="no-print print-help">Choose a PDF destination in the print dialog. A4, portrait, 100%; disable headers and footers.<template v-if="isPagedLayout(active.document.layout)"> Set margins to None for edge-to-edge output.</template></p>
        <CvPreview :doc="active.document" />
        <ClassicPrint
          v-if="isPagedLayout(active.document.layout)"
          ref="classicPrint"
          :key="active.document.id"
          :doc="active.document"
          @status="(count, message) => { classicPageCount = count; exceedsPage = count > 1; paginationError = message }"
        />
        <div v-if="active.document.layout === 'ats'" ref="printMeasure" class="print-measure no-print" aria-hidden="true">
          <CvPreview :doc="active.document" />
        </div>
      </div>
    </div>
  </div>
</template>
