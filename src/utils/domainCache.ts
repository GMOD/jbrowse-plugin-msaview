import { bestEffort, createDbOpener } from './idb'

import type { DomainMatch } from './ncbiDomains'
import type { DBSchema } from 'idb'

const DB_NAME = 'jbrowse-msaview-domain-cache'
const STORE_NAME = 'domains'
const DB_VERSION = 1

interface CachedDomain {
  accession: string
  matches: DomainMatch[]
}

interface DomainCacheDB extends DBSchema {
  [STORE_NAME]: {
    key: string
    value: CachedDomain
  }
}

const getDB = createDbOpener<DomainCacheDB>(DB_NAME, DB_VERSION, db => {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: 'accession' })
  }
})

export function getCachedDomains(accessions: string[]) {
  return bestEffort(
    'domain cache read',
    async () => {
      const db = await getDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const results = await Promise.all(
        accessions.map(accession => tx.store.get(accession)),
      )
      await tx.done
      return results
    },
    [],
  )
}

export function saveDomains(entries: CachedDomain[]) {
  return bestEffort(
    'domain cache write',
    async () => {
      const db = await getDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      for (const entry of entries) {
        await tx.store.put(entry)
      }
      await tx.done
    },
    undefined,
  )
}
