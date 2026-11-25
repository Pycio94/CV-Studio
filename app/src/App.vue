<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ClassicPrint from './ClassicPrint.vue'
import CvPreview from './CvPreview.vue'
import ItemEditor from './ItemEditor.vue'
import { formatErrorMessage, snapshotRecord, useCvStore } from './composables/useCvStore'
import { isPagedLayout, layouts } from './layouts'
import { importLegacy } from './legacy'
import { moveEntry, removeEntry, safeFilename } from './listUtils'
import { newContact, newExperience, safeUrl, type CvDocument, type HeadingKey } from './model'
import { createBackup, parseBackup } from './storage'

const {
  records,
  currentId,
  active,
  status,
  error,
  busy,
  tabWarning,
  switchDocument,
  addDocument,
  createDocument,
  duplicateDocument,
  removeDocument,
  resetDocument,
} = useCvStore()

const pdfImporting = ref(false)
const pdfHelp = ref(false)
const printMeasure = ref<HTMLElement | null>(null)
const classicPrint = ref<InstanceType<typeof ClassicPrint> | null>(null)
const exceedsPage = ref(false)
const paginationError = ref('')
const classicPageCount = ref(1)
const defaultTitle = 'CV Studio'

const headingLabels: Record<HeadingKey, string> = {
  contact: 'Contact heading',
  summary: 'Profile heading',
  experience: 'Experience heading',
  education: 'Education heading',
  skills: 'Skills heading',
  languages: 'Languages heading',
}

async function onSelectDocument(event: Event) {
  const select = event.target as HTMLSelectElement
  const switched = await switchDocument(select.value)
  if (!switched) select.value = currentId.value
}

function removeContact(index: number) {
  if (!active.value || !window.confirm('Remove this contact?')) return
  active.value.document.contacts = removeEntry(active.value.document.contacts, index)
}

function moveContact(index: number, offset: number) {
  if (!active.value) return
  active.value.document.contacts = moveEntry(active.value.document.contacts, index, offset)
}

function removeRole(index: number) {
  if (!active.value || !window.confirm('Remove this role?')) return
  active.value.document.experience = removeEntry(active.value.document.experience, index)
}

function moveRole(index: number, offset: number) {
  if (!active.value) return
  active.value.document.experience = moveEntry(active.value.document.experience, index, offset)
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
    let imported: { document: CvDocument; original?: CvDocument }
    if (kind === 'json') {
      const backup = parseBackup(JSON.parse(await file.text()))
      imported = { document: backup.document, original: backup.original }
    } else if (kind === 'pdf') {
      busy.value = true
      pdfImporting.value = true
      error.value = ''
      try {
        const { importPdf } = await import('./pdfImport')
        imported = { document: await importPdf(file) }
      } finally {
        pdfImporting.value = false
        busy.value = false
      }
    } else {
      imported = { document: importLegacy(await file.text()) }
    }

    if (window.confirm('Import this CV as a new document? Existing CVs will be kept.')) {
      await addDocument(imported.document, imported.original)
    }
  } catch (cause) {
    error.value = `Import failed: ${formatErrorMessage(cause)}. Existing CVs were not changed.`
  }
}

function exportDocument() {
  if (!active.value) return
  try {
    const data = JSON.stringify(createBackup(snapshotRecord(active.value)), null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeFilename(active.value.document.documentName || active.value.document.name || 'cv')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) {
    error.value = `Export failed: ${formatErrorMessage(cause)}`
  }
}

async function optimizePhoto(dataUrl: string, fileSize: number): Promise<string> {
  const maxDimension = 400
  const maxUnresizedBytes = 200_000
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth <= maxDimension && img.naturalHeight <= maxDimension && fileSize <= maxUnresizedBytes) {
        resolve(dataUrl)
        return
      }
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const resized = canvas.toDataURL('image/webp', 0.86)
      resolve(resized.startsWith('data:image/webp;base64,') ? resized : canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
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
    const rawData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image.'))
      reader.readAsDataURL(file)
    })
    const data = await optimizePhoto(rawData, file.size)
    if (active.value?.document.id !== targetId) {
      throw new Error('The selected CV changed before the photo finished loading; select the photo again.')
    }
    active.value.document.photo = data
    error.value = ''
  } catch (cause) {
    error.value = `Photo could not be loaded: ${formatErrorMessage(cause)}`
  }
}

function applyPrintTitle() {
  const name = active.value?.document.documentName.trim() || active.value?.document.name.trim()
  document.title = name || defaultTitle
}

function restorePrintTitle() {
  document.title = defaultTitle
}

async function printCv(pdf: boolean) {
  await nextTick()
  classicPrint.value?.paginate()
  if (paginationError.value) {
    error.value = paginationError.value
    return
  }
  pdfHelp.value = pdf
  applyPrintTitle()
  try {
    window.print()
  } finally {
    restorePrintTitle()
  }
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

onMounted(() => {
  window.addEventListener('beforeprint', applyPrintTitle)
  window.addEventListener('afterprint', restorePrintTitle)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', applyPrintTitle)
  window.removeEventListener('afterprint', restorePrintTitle)
  restorePrintTitle()
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
    <div v-if="tabWarning" class="alert no-print" role="alert">{{ tabWarning }}</div>
    <div v-if="active" class="workspace">
      <div class="editor no-print">
        <fieldset :disabled="busy" class="editor-fields">
          <div class="editor-heading">
            <div><h2>Your CV</h2><p>Edit the fields below to update the preview.</p></div>
            <span class="save-status" role="status">{{ pdfImporting ? 'Importing PDF...' : status }}</span>
          </div>
          <label>Choose CV
            <select :value="currentId" @change="onSelectDocument">
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
            <label>CV name <input v-model="active.document.documentName" maxlength="10000"></label>
            <label>Full name <input v-model="active.document.name" maxlength="10000"></label>
            <label>Professional title <input v-model="active.document.title" maxlength="10000"></label>
            <label>Profile summary <textarea v-model="active.document.summary" maxlength="10000" rows="3"></textarea></label>
            <label>Photo (PNG, JPEG or WebP; maximum 2 MB) <input type="file" accept="image/png,image/jpeg,image/webp" @change="uploadPhoto"></label>
            <div v-if="active.document.photo" class="photo-controls">
              <img :src="active.document.photo" alt="Uploaded portrait preview" class="photo-preview">
              <button type="button" @click="active.document.photo = ''">Remove photo</button>
            </div>
          </details>
          <details>
            <summary>Contact details</summary>
            <div v-for="(contact, index) in active.document.contacts" :key="contact.id" class="item-card">
              <div class="item-controls">
                <strong>Contact {{ index + 1 }}</strong>
                <button type="button" :disabled="index === 0" :aria-label="`Move contact ${index + 1} up`" @click="moveContact(index, -1)">Up</button>
                <button type="button" :disabled="index === active.document.contacts.length - 1" :aria-label="`Move contact ${index + 1} down`" @click="moveContact(index, 1)">Down</button>
                <button type="button" class="danger" :aria-label="`Remove contact ${index + 1}`" @click="removeContact(index)">Remove</button>
              </div>
              <label>Label <input v-model="contact.label" maxlength="10000"></label>
              <label>Value <input v-model="contact.value" maxlength="10000"></label>
              <label>Link (optional) <input v-model="contact.url" maxlength="10000" placeholder="https://, mailto: or tel:"></label>
              <p v-if="contact.url && !safeUrl(contact.url)" class="field-error">Use a valid http, https, mailto, or tel link.</p>
            </div>
            <button type="button" :disabled="active.document.contacts.length >= 100" @click="active.document.contacts.push(newContact())">+ Add contact</button>
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
                <button type="button" :disabled="index === 0" :aria-label="`Move role ${index + 1} up`" @click="moveRole(index, -1)">Up</button>
                <button type="button" :disabled="index === active.document.experience.length - 1" :aria-label="`Move role ${index + 1} down`" @click="moveRole(index, 1)">Down</button>
                <button type="button" class="danger" :aria-label="`Remove role ${index + 1}`" @click="removeRole(index)">Remove</button>
              </div>
              <label>Job title <input v-model="entry.title" maxlength="10000"></label>
              <label>Company <input v-model="entry.company" maxlength="10000"></label>
              <label>Dates <input v-model="entry.dates" maxlength="10000"></label>
              <label>Description <textarea v-model="entry.description" maxlength="10000" rows="3"></textarea></label>
              <ItemEditor v-model:items="entry.bullets" label="Bullet" detail-label="Additional detail" />
            </div>
            <button type="button" :disabled="active.document.experience.length >= 100" @click="active.document.experience.push(newExperience())">+ Add experience</button>
          </details>
          <details><summary>Education</summary><ItemEditor v-model:items="active.document.education" label="Education" detail-label="Institution and dates" /></details>
          <details><summary>Skills</summary><ItemEditor v-model:items="active.document.skills" label="Skill" detail-label="Detail" /></details>
          <details><summary>Languages</summary><ItemEditor v-model:items="active.document.languages" label="Language" detail-label="Proficiency" /></details>
          <details>
            <summary>Section headings and consent</summary>
            <label v-for="(label, key) in headingLabels" :key="key">{{ label }} <input v-model="active.document.headings[key]" maxlength="10000"></label>
            <label class="check-label"><input v-model="active.document.showConsent" type="checkbox"> Include consent statement</label>
            <label>Consent statement <textarea v-model="active.document.consent" maxlength="10000" rows="4"></textarea></label>
          </details>
        </fieldset>
      </div>
      <div class="preview-panel">
        <div class="preview-toolbar no-print">
          <div><h2>Preview</h2><p>Classic and Timeline show A4 pages in two columns; ATS uses a single column.</p></div>
          <label>Layout
            <select v-model="active.document.layout">
              <option v-for="layout in layouts" :key="layout.id" :value="layout.id">{{ layout.label }}</option>
            </select>
          </label>
        </div>
        <p v-if="exceedsPage" class="page-warning no-print">Your CV may span multiple A4 pages. Check browser print preview.</p>
        <p v-if="paginationError" class="alert no-print" role="alert">{{ paginationError }}</p>
        <p v-if="pdfHelp" class="no-print print-help">Choose a PDF destination in the print dialog. A4, portrait, 100%; disable headers and footers.<template v-if="isPagedLayout(active.document.layout)"> Set margins to None for edge-to-edge output.</template></p>
        <CvPreview v-if="!isPagedLayout(active.document.layout)" :doc="active.document" />
        <ClassicPrint
          v-else
          ref="classicPrint"
          :key="active.document.id"
          :doc="active.document"
          @status="(count, message) => { classicPageCount = count; exceedsPage = count > 1; paginationError = message }"
        />
        <div v-if="!isPagedLayout(active.document.layout)" ref="printMeasure" class="print-measure no-print" aria-hidden="true">
          <CvPreview :doc="active.document" />
        </div>
      </div>
    </div>
  </div>
</template>
