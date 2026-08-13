import { createDbOpener } from './idb'

import type {
  BlastDatabase,
  MsaAlgorithm,
  PhmmerDatabase,
  SearchProgram,
} from '../LaunchMsaView/components/BlastQuery/consts'
import type { DBSchema } from 'idb'

const DB_NAME = 'jbrowse-msaview-blast-cache'
const STORE_NAME = 'blast-results'
const DB_VERSION = 2

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
  return entry
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
