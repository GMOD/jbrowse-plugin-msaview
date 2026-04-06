import { openDB } from 'idb'

const DB_NAME = 'jbrowse-msaview-data'
const DB_VERSION = 1
const STORE_NAME = 'msa-data'

interface StoredMsaData {
  id: string
  msa?: string
  tree?: string
  treeMetadata?: string
  timestamp: number
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    },
  })
}

export function generateDataStoreId() {
  return `msa-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export async function storeMsaData(
  id: string,
  data: { msa?: string; tree?: string; treeMetadata?: string },
) {
  try {
    const db = await getDB()
    const storedData: StoredMsaData = {
      id,
      msa: data.msa,
      tree: data.tree,
      treeMetadata: data.treeMetadata,
      timestamp: Date.now(),
    }
    await db.put(STORE_NAME, storedData)
    return true
  } catch (e) {
    console.warn('Failed to store MSA data:', e)
    return false
  }
}

export async function retrieveMsaData(id: string) {
  try {
    const db = await getDB()
    const result = (await db.get(STORE_NAME, id)) as StoredMsaData | undefined
    if (result) {
      return {
        msa: result.msa,
        tree: result.tree,
        treeMetadata: result.treeMetadata,
      }
    }
    return undefined
  } catch (e) {
    console.warn('Failed to retrieve MSA data:', e)
    return undefined
  }
}

export async function deleteMsaData(id: string) {
  try {
    const db = await getDB()
    await db.delete(STORE_NAME, id)
  } catch (e) {
    console.warn('Failed to delete MSA data:', e)
  }
}

export async function cleanupOldData(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const db = await getDB()
    const cutoffTime = Date.now() - maxAgeMs
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const index = tx.store.index('timestamp')
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoffTime))
    let deletedCount = 0
    while (cursor) {
      await cursor.delete()
      deletedCount++
      cursor = await cursor.continue()
    }
    return deletedCount
  } catch (e) {
    console.warn('Failed to cleanup old MSA data:', e)
    return 0
  }
}
