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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cv-studio', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('documents', { keyPath: 'document.id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'))
    request.onblocked = () => reject(new Error('Local storage is blocked by another browser tab.'))
  })
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', mode)
    const request = operation(tx.objectStore('documents'))
    let result: T
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local storage failed.')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local storage was interrupted.')) }
  })
}

export async function loadRecords(): Promise<CvRecord[]> {
  const records = await transaction('readonly', store => store.getAll())
  return z.array(recordSchema).parse(records)
}

export async function saveRecord(record: CvRecord): Promise<void> {
  const validated = recordSchema.parse(record)
  await transaction('readwrite', store => store.put(validated))
}

export async function deleteRecord(id: string): Promise<void> {
  await transaction('readwrite', store => store.delete(id))
}
