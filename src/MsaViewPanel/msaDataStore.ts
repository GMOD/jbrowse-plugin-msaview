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

let dbPromise: Promise<IDBDatabase> | undefined

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })

  return dbPromise
}

export function generateDataStoreId() {
  return `msa-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export async function storeMsaData(
  id: string,
  data: { msa?: string; tree?: string; treeMetadata?: string },
) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const storedData: StoredMsaData = {
      id,
      msa: data.msa,
      tree: data.tree,
      treeMetadata: data.treeMetadata,
      timestamp: Date.now(),
    }

    const request = store.put(storedData)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

export async function retrieveMsaData(
  id: string,
): Promise<{ msa?: string; tree?: string; treeMetadata?: string } | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      const result = request.result as StoredMsaData | undefined
      if (result) {
        resolve({
          msa: result.msa,
          tree: result.tree,
          treeMetadata: result.treeMetadata,
        })
      } else {
        resolve(undefined)
      }
    }
  })
}

export async function deleteMsaData(id: string) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

// Clean up entries older than the specified age (default 7 days)
export async function cleanupOldData(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const db = await openDB()
  const cutoffTime = Date.now() - maxAgeMs

  return new Promise<number>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    const range = IDBKeyRange.upperBound(cutoffTime)
    const request = index.openCursor(range)

    let deletedCount = 0

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        deletedCount++
        cursor.continue()
      } else {
        resolve(deletedCount)
      }
    }
  })
}
