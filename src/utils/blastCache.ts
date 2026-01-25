import { openDB } from 'idb'

import type { BlastResults } from './types'

const DB_NAME = 'jbrowse-msaview-blast-cache'
const STORE_NAME = 'blast-results'
const DB_VERSION = 1

export interface CachedBlastResult {
  id: string
  proteinSequence: string
  blastDatabase: string
  blastProgram: string
  msaAlgorithm: string
  hits: BlastResults['BlastOutput2'][0]['report']['results']['search']['hits']
  rid: string
  timestamp: number
  geneId?: string
  transcriptId?: string
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('by-sequence', 'proteinSequence')
        store.createIndex('by-timestamp', 'timestamp')
        store.createIndex('by-gene', 'geneId')
      }
    },
  })
}

function createCacheKey(
  proteinSequence: string,
  blastDatabase: string,
  blastProgram: string,
) {
  return `${blastDatabase}:${blastProgram}:${proteinSequence.slice(0, 100)}`
}

export async function getCachedBlastResult({
  proteinSequence,
  blastDatabase,
  blastProgram,
}: {
  proteinSequence: string
  blastDatabase: string
  blastProgram: string
}) {
  const db = await getDB()
  const id = createCacheKey(proteinSequence, blastDatabase, blastProgram)
  return db.get(STORE_NAME, id)
}

export async function saveBlastResult({
  proteinSequence,
  blastDatabase,
  blastProgram,
  msaAlgorithm,
  hits,
  rid,
  geneId,
  transcriptId,
}: {
  proteinSequence: string
  blastDatabase: string
  blastProgram: string
  msaAlgorithm: string
  hits: CachedBlastResult['hits']
  rid: string
  geneId?: string
  transcriptId?: string
}) {
  const db = await getDB()
  const id = createCacheKey(proteinSequence, blastDatabase, blastProgram)
  const entry: CachedBlastResult = {
    id,
    proteinSequence,
    blastDatabase,
    blastProgram,
    msaAlgorithm,
    hits,
    rid,
    timestamp: Date.now(),
    geneId,
    transcriptId,
  }
  await db.put(STORE_NAME, entry)
  return entry
}

export async function getAllCachedResults() {
  const db = await getDB()
  const results = await db.getAll(STORE_NAME)
  return results.sort((a, b) => b.timestamp - a.timestamp)
}

export async function deleteCachedResult(id: string) {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function clearAllCachedResults() {
  const db = await getDB()
  await db.clear(STORE_NAME)
}
