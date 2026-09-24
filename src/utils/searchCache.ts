import { bestEffort, createDbOpener } from './idb'

import type { DBSchema } from 'idb'

const DB_NAME = 'jbrowse-msaview-search-cache'
const STORE_NAME = 'searches'
const MAX_CACHED_SEARCHES = 20

export interface CachedSearch {
  id: string
  fasta: string
  treeMetadata: Record<string, Record<string, string>>
  rid?: string
  timestamp: number
}

interface SearchCacheDB extends DBSchema {
  [STORE_NAME]: {
    key: string
    value: CachedSearch
  }
}

const getDB = createDbOpener<SearchCacheDB>(DB_NAME, 1, db => {
  db.createObjectStore(STORE_NAME, { keyPath: 'id' })
})

export function searchKey({
  searchProgram,
  database,
  maxHits,
  querySeqName,
  query,
}: {
  searchProgram: string
  database: string
  maxHits?: number
  querySeqName: string
  query: string
}) {
  return [searchProgram, database, maxHits ?? '', querySeqName, query].join(':')
}

export function getCachedSearch(id: string) {
  return bestEffort(
    'search cache read',
    async () => (await getDB()).get(STORE_NAME, id),
    undefined,
  )
}

export function saveSearch(entry: Omit<CachedSearch, 'timestamp'>) {
  return bestEffort(
    'search cache write',
    async () => {
      const db = await getDB()
      await db.put(STORE_NAME, { ...entry, timestamp: Date.now() })
      if ((await db.count(STORE_NAME)) > MAX_CACHED_SEARCHES) {
        const all = await db.getAll(STORE_NAME)
        const doomed = all
          .toSorted((a, b) => a.timestamp - b.timestamp)
          .slice(0, all.length - MAX_CACHED_SEARCHES)
        const tx = db.transaction(STORE_NAME, 'readwrite')
        await Promise.all([...doomed.map(e => tx.store.delete(e.id)), tx.done])
      }
    },
    undefined,
  )
}
