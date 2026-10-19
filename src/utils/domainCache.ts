import { deleteDB } from 'idb'

import { bestEffort, createDbOpener } from './idb'

import type { DomainMatch } from './ncbiDomains'
import type { DBSchema } from 'idb'

// v2: a site's locations are its residues, where v1 stored one bounding span.
// v3: each match keeps its GenPept key, Region or Site, which a v2 entry lacks
// and which would otherwise class every cached site as a domain for good.
// A new name rather than a new version, so an older tab still open keeps its
// own database instead of blocking the upgrade.
const DB_NAME = 'jbrowse-msaview-domain-cache-v3'
const RETIRED_DB_NAMES = [
  'jbrowse-msaview-domain-cache',
  'jbrowse-msaview-domain-cache-v2',
]
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

const openDB = createDbOpener<DomainCacheDB>(DB_NAME, DB_VERSION, db => {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: 'accession' })
  }
})

let retiredDropped = false

function getDB() {
  if (!retiredDropped) {
    retiredDropped = true
    for (const name of RETIRED_DB_NAMES) {
      Promise.resolve()
        .then(() => deleteDB(name))
        .catch(() => {})
    }
  }
  return openDB()
}

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
