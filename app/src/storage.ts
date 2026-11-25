import { z } from 'zod'
import { documentSchema, type CvDocument } from './model'

const recordSchema = z.object({ document: documentSchema, original: documentSchema })
const backupSchema = z.object({
  format: z.literal('cv-studio-backup'),
  version: z.literal(1),
  document: documentSchema,
  original: documentSchema,
})
export type CvRecord = { document: CvDocument; original: CvDocument }
export interface LoadRecordsResult {
  records: CvRecord[]
  corruptedCount: number
}

let dbPromise: Promise<IDBDatabase> | null = null

export function parseBackup(data: unknown): CvRecord {
  const record = backupSchema.safeParse(data)
  if (record.success) {
    return { document: record.data.document, original: record.data.original }
  }
  const document = documentSchema.parse(data)
  return { document, original: structuredClone(document) }
}

export function createBackup(record: CvRecord) {
  const validated = recordSchema.parse(record)
  return {
    format: 'cv-studio-backup' as const,
    version: 1 as const,
    document: validated.document,
    original: validated.original,
  }
}

export function parseStoredRecords(raw: unknown[]): LoadRecordsResult {
  const records: CvRecord[] = []
  let corruptedCount = 0
  for (const entry of raw) {
    const parsed = recordSchema.safeParse(entry)
    if (parsed.success) records.push(parsed.data)
    else corruptedCount++
  }
  return { records, corruptedCount }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable.'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('cv-studio', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('documents')) {
          request.result.createObjectStore('documents', { keyPath: 'document.id' })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        db.onclose = () => { dbPromise = null }
        db.onversionchange = () => { db.close(); dbPromise = null }
        resolve(db)
      }
      request.onerror = () => {
        dbPromise = null
        reject(request.error ?? new Error('Could not open local storage.'))
      }
      request.onblocked = () => {
        dbPromise = null
        reject(new Error('Local storage is blocked by another browser tab.'))
      }
    })
  }
  return dbPromise
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction
    try {
      tx = db.transaction('documents', mode)
    } catch (cause) {
      dbPromise = null
      reject(cause)
      return
    }
    const request = operation(tx.objectStore('documents'))
    let result: T
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error('Local storage failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Local storage was interrupted.'))
  })
}

export async function loadRecords(): Promise<LoadRecordsResult> {
  const raw = await transaction('readonly', store => store.getAll())
  return parseStoredRecords(raw)
}

export async function saveRecord(record: CvRecord): Promise<void> {
  const validated = recordSchema.parse(record)
  await transaction('readwrite', store => store.put(validated))
}

export async function deleteRecord(id: string): Promise<void> {
  await transaction('readwrite', store => store.delete(id))
}
