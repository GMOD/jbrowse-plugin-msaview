import { openDB } from 'idb'

const DB_NAME = 'jbrowse-msaview-blast-cache'
const STORE_NAME = 'blast-results'
const DB_VERSION = 2

export interface CachedBlastResult {
  id: string
  proteinSequence: string
  blastDatabase: string
  blastProgram: string
  msaAlgorithm: string
  msa: string
  tree: string
  treeMetadata: string
  rid: string
  timestamp: number
  geneId?: string
  transcriptId?: string
  transcriptName?: string
  geneName?: string
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    },
  })
}

function createCacheKey(
  proteinSequence: string,
  blastDatabase: string,
  blastProgram: string,
  transcriptId?: string,
) {
  const seqKey = proteinSequence.slice(0, 100)
  if (transcriptId) {
    return `${blastDatabase}:${blastProgram}:${transcriptId}:${seqKey}`
  }
  return `${blastDatabase}:${blastProgram}:${seqKey}`
}

export async function getCachedBlastResult({
  proteinSequence,
  blastDatabase,
  blastProgram,
  transcriptId,
}: {
  proteinSequence: string
  blastDatabase: string
  blastProgram: string
  transcriptId?: string
}) {
  const db = await getDB()
  const id = createCacheKey(
    proteinSequence,
    blastDatabase,
    blastProgram,
    transcriptId,
  )
  return db.get(STORE_NAME, id)
}

export async function saveBlastResult({
  proteinSequence,
  blastDatabase,
  blastProgram,
  msaAlgorithm,
  msa,
  tree,
  treeMetadata,
  rid,
  geneId,
  transcriptId,
  transcriptName,
  geneName,
}: {
  proteinSequence: string
  blastDatabase: string
  blastProgram: string
  msaAlgorithm: string
  msa: string
  tree: string
  treeMetadata: string
  rid: string
  geneId?: string
  transcriptId?: string
  transcriptName?: string
  geneName?: string
}) {
  const db = await getDB()
  const id = createCacheKey(
    proteinSequence,
    blastDatabase,
    blastProgram,
    transcriptId,
  )
  const entry: CachedBlastResult = {
    id,
    proteinSequence,
    blastDatabase,
    blastProgram,
    msaAlgorithm,
    msa,
    tree,
    treeMetadata,
    rid,
    timestamp: Date.now(),
    geneId,
    transcriptId,
    transcriptName,
    geneName,
  }
  await db.put(STORE_NAME, entry)
  return entry
}

export async function getAllCachedResults() {
  const db = await getDB()
  const results = await db.getAll(STORE_NAME)
  return results.toSorted((a, b) => b.timestamp - a.timestamp)
}

export async function getCachedResultsByGeneId(geneId: string) {
  const db = await getDB()
  const results = await db.getAll(STORE_NAME)
  return results
    .filter(r => r.geneId === geneId)
    .toSorted((a, b) => b.timestamp - a.timestamp)
}

export async function deleteCachedResult(id: string) {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function clearAllCachedResults() {
  const db = await getDB()
  await db.clear(STORE_NAME)
}
