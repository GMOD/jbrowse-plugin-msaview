import { defaultMaxHits } from '../LaunchMsaView/components/BlastQuery/consts'
import { bestEffort, createDbOpener } from './idb'

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
  /** absent on rows saved before it was recorded */
  maxHits?: number
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

/**
 * One history row per distinct search. Every input that changes the stored
 * alignment is in the key, or re-running the query with another aligner or hit
 * count overwrites the earlier row. A part added later is left out at its old
 * value so rows saved before it still resolve: phmmer keys are prefixed and
 * blastp keys are not, and the hit count appears only when it is not the
 * default.
 */
export function createCacheKey({
  proteinSequence,
  blastDatabase,
  msaAlgorithm,
  searchProgram,
  transcriptId,
  maxHits,
}: {
  proteinSequence: string
  blastDatabase: BlastDatabase | PhmmerDatabase
  msaAlgorithm?: MsaAlgorithm
  searchProgram?: SearchProgram
  transcriptId?: string
  maxHits?: number
}) {
  const idPart = transcriptId ? `:${transcriptId}` : ''
  const hitsPart =
    maxHits === undefined || maxHits === defaultMaxHits ? '' : `:n${maxHits}`
  return searchProgram === 'phmmer'
    ? `phmmer:${blastDatabase}${idPart}${hitsPart}:${proteinSequence}`
    : `${blastDatabase}:${msaAlgorithm}${idPart}${hitsPart}:${proteinSequence}`
}

/**
 * Record a finished search in the history. Best effort: the alignment is
 * already in hand, and a browser refusing the write must not turn it into a
 * failed launch.
 */
export function saveBlastResult({
  proteinSequence,
  blastDatabase,
  msaAlgorithm,
  searchProgram,
  maxHits,
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
  maxHits?: number
  msa: string
  tree: string
  treeMetadata: string
  rid: string
  geneId?: string
  transcriptId?: string
  transcriptName?: string
  geneName?: string
}) {
  return bestEffort(
    'BLAST history write',
    async () => {
      const db = await getDB()
      const entry: CachedBlastResult = {
        id: createCacheKey({
          proteinSequence,
          blastDatabase,
          msaAlgorithm,
          searchProgram,
          transcriptId,
          maxHits,
        }),
        proteinSequence,
        blastDatabase,
        msaAlgorithm,
        searchProgram,
        maxHits,
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
    },
    undefined,
  )
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
