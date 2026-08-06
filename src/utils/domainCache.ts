import { createDbOpener } from './idb'

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

export async function getCachedDomains(accessions: string[]) {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const results = await Promise.all(
    accessions.map(accession => tx.store.get(accession)),
  )
  await tx.done
  return results
}

export async function saveDomains(entries: CachedDomain[]) {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  for (const entry of entries) {
    await tx.store.put(entry)
  }
  await tx.done
}
