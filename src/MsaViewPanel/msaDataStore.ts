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

let dbPromise: Promise<IDBDatabase | undefined> | undefined
let indexedDBAvailable: boolean | undefined

function checkIndexedDBAvailable(): boolean {
  if (indexedDBAvailable !== undefined) {
    return indexedDBAvailable
  }

  try {
    // Check if indexedDB exists and is accessible
    if (typeof indexedDB === 'undefined') {
      indexedDBAvailable = false
      return false
    }

    // Try to open a test database to verify IndexedDB is working
    // This can fail in private browsing mode in some browsers
    indexedDBAvailable = true
    return true
  } catch {
    indexedDBAvailable = false
    return false
  }
}

async function openDB(): Promise<IDBDatabase | undefined> {
  if (!checkIndexedDBAvailable()) {
    return undefined
  }

  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.addEventListener('error', () => {
        // IndexedDB may be blocked in private browsing mode
        console.warn(
          'IndexedDB unavailable - MSA data will not persist across page refreshes',
        )
        indexedDBAvailable = false
        resolve(undefined)
      })

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
    } catch (e) {
      console.warn('Failed to open IndexedDB:', e)
      indexedDBAvailable = false
      resolve(undefined)
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
): Promise<boolean> {
  const db = await openDB()
  if (!db) {
    // IndexedDB not available, silently skip storage
    return false
  }

  return new Promise<boolean>(resolve => {
    try {
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

      request.addEventListener('error', () => {
        // Log but don't fail - storage is best-effort
        console.warn('Failed to store MSA data:', request.error)
        resolve(false)
      })

      request.onsuccess = () => {
        resolve(true)
      }
    } catch (e) {
      console.warn('Failed to store MSA data:', e)
      resolve(false)
    }
  })
}

export async function retrieveMsaData(
  id: string,
): Promise<{ msa?: string; tree?: string; treeMetadata?: string } | undefined> {
  const db = await openDB()
  if (!db) {
    return undefined
  }

  return new Promise(resolve => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.addEventListener('error', () => {
        console.warn('Failed to retrieve MSA data:', request.error)
        resolve(undefined)
      })

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
    } catch (e) {
      console.warn('Failed to retrieve MSA data:', e)
      resolve(undefined)
    }
  })
}

export async function deleteMsaData(id: string) {
  const db = await openDB()
  if (!db) {
    return
  }

  return new Promise<void>(resolve => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.addEventListener('error', () => {
        console.warn('Failed to delete MSA data:', request.error)
        resolve()
      })

      request.onsuccess = () => {
        resolve()
      }
    } catch (e) {
      console.warn('Failed to delete MSA data:', e)
      resolve()
    }
  })
}

// Clean up entries older than the specified age (default 7 days)
export async function cleanupOldData(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const db = await openDB()
  if (!db) {
    return 0
  }

  const cutoffTime = Date.now() - maxAgeMs

  return new Promise<number>(resolve => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const range = IDBKeyRange.upperBound(cutoffTime)
      const request = index.openCursor(range)

      let deletedCount = 0

      request.addEventListener('error', () => {
        console.warn('Failed to cleanup old MSA data:', request.error)
        resolve(deletedCount)
      })

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }
    } catch (e) {
      console.warn('Failed to cleanup old MSA data:', e)
      resolve(0)
    }
  })
}

// Check if IndexedDB storage is available
export function isIndexedDBAvailable() {
  return checkIndexedDBAvailable()
}
