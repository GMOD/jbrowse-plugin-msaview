import { createDbOpener } from './idb'

import type {
  BlastDatabase,
  MsaAlgorithm,
  PhmmerDatabase,
  SearchProgram,
} from '../LaunchMsaView/components/BlastQuery/consts'
import type { DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'jbrowse-msaview-blast-cache'
const STORE_NAME = 'blast-results'
const DB_VERSION = 2

/**
 * How many results the history keeps. Every row holds a whole alignment and its
 * tree — megabytes each — so an unbounded store grows until the browser starts
 * refusing writes to it, and the user never sees why.
 */
const MAX_CACHED_RESULTS = 50

export interface CachedBlastResult {
  id: string
  proteinSequence: string
  blastDatabase: BlastDatabase | PhmmerDatabase
  /**
   * Only ever set on rows cached by a version that still queried NCBI, where
   * the choice between blastp and quick-blastp was real. Kept so those rows
   * still display; never written now.
   */
  blastProgram?: string
  /** absent on rows cached before phmmer existed, which were all blastp */
  searchProgram?: SearchProgram
  /** absent on phmmer rows, which are aligned by the search itself */
  msaAlgorithm?: MsaAlgorithm
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

interface BlastCacheDB extends DBSchema {
  [STORE_NAME]: {
    key: string
    value: CachedBlastResult
  }
}

const getDB = createDbOpener<BlastCacheDB>(
  DB_NAME,
  DB_VERSION,
  (db, oldVersion) => {
    if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
      db.deleteObjectStore(STORE_NAME)
    }
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  },
)

function createCacheKey({
  proteinSequence,
  blastDatabase,
  msaAlgorithm,
  searchProgram,
  transcriptId,
}: {
  proteinSequence: string
  blastDatabase: BlastDatabase | PhmmerDatabase
  msaAlgorithm?: MsaAlgorithm
  searchProgram?: SearchProgram
  transcriptId?: string
}) {
  const idPart = transcriptId ? `:${transcriptId}` : ''
  // phmmer keys are prefixed and blastp keys are left exactly as they were, so
  // results cached before phmmer existed still resolve
  if (searchProgram === 'phmmer') {
    return `phmmer:${blastDatabase}${idPart}:${proteinSequence}`
  }
  // msaAlgorithm is part of the key because the stored msa/tree are produced by
  // it — without it, re-running the same query under a different algorithm
  // overwrites the earlier result and drops it from the history list
  return `${blastDatabase}:${msaAlgorithm}${idPart}:${proteinSequence}`
}

export async function saveBlastResult({
  proteinSequence,
  blastDatabase,
  msaAlgorithm,
  searchProgram,
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
  blastDatabase: BlastDatabase | PhmmerDatabase
  msaAlgorithm?: MsaAlgorithm
  searchProgram?: SearchProgram
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
  const id = createCacheKey({
    proteinSequence,
    blastDatabase,
    msaAlgorithm,
    searchProgram,
    transcriptId,
  })
  const entry: CachedBlastResult = {
    id,
    proteinSequence,
    blastDatabase,
    msaAlgorithm,
    searchProgram,
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
  await evictOldest(db)
  return entry
}

/**
 * Drop the oldest rows until the store is back at MAX_CACHED_RESULTS.
 *
 * `count` first so the common save reads no values at all: without a timestamp
 * index the oldest have to be found by loading every row, and each one is an
 * entire alignment. Failing to evict must not fail the save — the result is
 * already in hand and losing it to a housekeeping error would be the worse
 * outcome.
 */
async function evictOldest(db: IDBPDatabase<BlastCacheDB>) {
  try {
    if ((await db.count(STORE_NAME)) <= MAX_CACHED_RESULTS) {
      return
    }
    const all = await db.getAll(STORE_NAME)
    const doomed = all
      .toSorted((a, b) => a.timestamp - b.timestamp)
      .slice(0, all.length - MAX_CACHED_RESULTS)
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await Promise.all([...doomed.map(e => tx.store.delete(e.id)), tx.done])
  } catch (e) {
    console.warn('Failed to evict old BLAST cache entries:', e)
  }
}

export async function getAllCachedResults() {
  const db = await getDB()
  const results = await db.getAll(STORE_NAME)
  return results.toSorted((a, b) => b.timestamp - a.timestamp)
}

export async function deleteCachedResult(id: string) {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
