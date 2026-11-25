import { deleteDB } from 'idb'

import { createDbOpener, getMany, putMany } from './idb'

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
  return getMany('domain cache', getDB, STORE_NAME, accessions)
}

export function saveDomains(entries: CachedDomain[]) {
  return putMany('domain cache', getDB, STORE_NAME, entries)
}
