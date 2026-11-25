import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { z } from 'zod'
import { cloneDocument, exampleDocument, newId, type CvDocument } from '../model'
import { deleteRecord, loadRecords, saveRecord, type CvRecord } from '../storage'

export function formatErrorMessage(cause: unknown): string {
  if (cause instanceof z.ZodError) {
    return cause.issues
      .map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .join('; ')
  }
  return cause instanceof Error ? cause.message : String(cause)
}

export function snapshotRecord(record: CvRecord): CvRecord {
  return { document: cloneDocument(record.document), original: cloneDocument(record.original) }
}

export function useCvStore() {
  const records = ref<CvRecord[]>([])
  const currentId = ref('')
  const active = computed(() => records.value.find(record => record.document.id === currentId.value))
  const status = ref('Loading local CVs...')
  const error = ref('')
  const ready = ref(false)
  const busy = ref(false)
  const tabWarning = ref('')

  let timer: ReturnType<typeof setTimeout> | undefined
  let saveChain: Promise<void> = Promise.resolve()
  let revision = 0
  let storageReadable = true
  let watchedDocId = ''
  const tabId = newId()
  let channel: BroadcastChannel | undefined

  function warnBeforeLeaving(event: BeforeUnloadEvent) {
    if (busy.value || status.value !== 'Saved locally') {
      event.preventDefault()
      event.returnValue = ''
    }
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
      copy = snapshotRecord(record)
    } catch (cause) {
      error.value = `Cannot save: ${formatErrorMessage(cause)}`
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
      channel?.postMessage({ type: 'saved', tabId, docId: copy.document.id })
      return true
    } catch (cause) {
      status.value = 'Not saved'
      error.value = `Local save failed: ${formatErrorMessage(cause)}. Export your draft before closing this page.`
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

  // Only mark dirty when the active document's own fields mutate, not when switching records.
  watch(
    () => active.value?.document,
    (doc) => {
      if (!ready.value || !doc) return
      if (doc.id !== watchedDocId) {
        watchedDocId = doc.id
        return
      }
      revision++
      status.value = 'Unsaved changes'
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void saveCurrent() }, 500)
    },
    { deep: true, flush: 'sync' },
  )

  onMounted(async () => {
    window.addEventListener('beforeunload', warnBeforeLeaving)
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('cv-studio-sync')
      channel.onmessage = (event: MessageEvent<{ type?: string; tabId?: string; docId?: string }>) => {
        if (event.data?.type === 'saved' && event.data.tabId !== tabId && event.data.docId === currentId.value) {
          tabWarning.value = 'This CV was saved in another browser tab. Reload before editing to avoid overwriting newer changes.'
        }
      }
    }

    try {
      const loaded = await loadRecords()
      records.value = loaded.records
      if (!records.value.length) {
        const doc = exampleDocument()
        records.value = [{ document: doc, original: cloneDocument(doc) }]
        await saveRecord(snapshotRecord(records.value[0]!))
      }
      currentId.value = records.value[0]!.document.id
      watchedDocId = currentId.value
      status.value = 'Saved locally'
      if (loaded.corruptedCount > 0) {
        error.value = `${loaded.corruptedCount} stored CV record(s) could not be read and were skipped. Healthy CVs remain editable; export backups before clearing site storage.`
      }
    } catch (cause) {
      storageReadable = false
      const doc = exampleDocument()
      records.value = [{ document: doc, original: cloneDocument(doc) }]
      currentId.value = doc.id
      watchedDocId = doc.id
      status.value = 'Not saved'
      error.value = `Could not read local CVs: ${formatErrorMessage(cause)}. Existing data was not changed. This draft is only in memory; export it before closing.`
    }
    ready.value = true
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', warnBeforeLeaving)
    if (timer) clearTimeout(timer)
    channel?.close()
  })

  async function switchDocument(nextId: string): Promise<boolean> {
    if (nextId === currentId.value) return true
    busy.value = true
    try {
      if (!(await flushCurrent())) return false
      watchedDocId = nextId
      currentId.value = nextId
      tabWarning.value = ''
      return true
    } finally {
      busy.value = false
    }
  }

  async function addDocument(doc: CvDocument, original: CvDocument = doc): Promise<boolean> {
    busy.value = true
    try {
      if (!(await flushCurrent())) return false
      const copy = cloneDocument(doc)
      copy.id = newId()
      const originalCopy = cloneDocument(original)
      originalCopy.id = copy.id
      const record = { document: copy, original: originalCopy }
      await saveRecord(snapshotRecord(record))
      records.value.push(record)
      watchedDocId = copy.id
      currentId.value = copy.id
      status.value = 'Saved locally'
      error.value = ''
      tabWarning.value = ''
      return true
    } catch (cause) {
      error.value = `Could not add CV: ${formatErrorMessage(cause)}`
      return false
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

  async function removeDocument(): Promise<void> {
    const record = active.value
    if (!record || !window.confirm(`Delete "${record.document.documentName || 'this CV'}"? This cannot be undone.`)) return
    busy.value = true
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    try {
      await deleteRecord(record.document.id)
      records.value = records.value.filter(item => item.document.id !== record.document.id)
      if (!records.value.length) {
        const doc = exampleDocument()
        const replacement = { document: doc, original: cloneDocument(doc) }
        await saveRecord(snapshotRecord(replacement))
        records.value = [replacement]
      }
      const nextId = records.value[0]!.document.id
      watchedDocId = nextId
      currentId.value = nextId
      status.value = 'Saved locally'
      error.value = ''
      tabWarning.value = ''
    } catch (cause) {
      error.value = `Could not delete CV: ${formatErrorMessage(cause)}`
    } finally {
      busy.value = false
    }
  }

  function resetDocument() {
    if (!active.value || !window.confirm('Reset this CV to its original imported or created state? Current changes will be lost.')) return
    active.value.document = cloneDocument(active.value.original)
  }

  return {
    records,
    currentId,
    active,
    status,
    error,
    ready,
    busy,
    tabWarning,
    saveCurrent,
    flushCurrent,
    switchDocument,
    addDocument,
    createDocument,
    duplicateDocument,
    removeDocument,
    resetDocument,
  }
}
