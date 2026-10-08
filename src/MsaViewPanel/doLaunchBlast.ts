import { defaultMaxHits } from '../LaunchMsaView/components/BlastQuery/consts'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import { saveBlastResult } from '../utils/blastCache'
import { checkPairSize } from '../utils/browserAlign'
import { searchBackends } from '../utils/homologSearch'
import { launchMSA } from '../utils/msa'
import { buildSearchMsa } from '../utils/msaRows'
import { getCachedSearch, saveSearch, searchKey } from '../utils/searchCache'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'
import { resolveUniProtEntry } from '../utils/unirefHomologs'
import { str, transcriptFields, transcriptName } from './util'

import type { JBrowsePluginMsaViewModel } from './model'
import type { LaunchScope, LaunchedData } from './runLaunch'

/**
 * The query sequence, and what its row is called. The dialog hands over the
 * translated transcript and the row stays `QUERY`; a spec naming a UniProt
 * accession has the sequence fetched and the row named after the entry
 * (`P53_HUMAN_query`), since a search of swissprot returns the entry itself
 * as a hit and two rows called the same thing collapse into one.
 */
async function resolveQuery(
  self: JBrowsePluginMsaViewModel,
  scope: LaunchScope,
) {
  const params = self.blastParams!
  if (params.proteinSequence) {
    return {
      sequence: cleanProteinSequence(params.proteinSequence),
      name: self.querySeqName,
    }
  }
  if (params.accession) {
    scope.onProgress(`Fetching ${params.accession} from UniProt...`)
    const entry = await resolveUniProtEntry([params.accession], 0, scope.signal)
    if (!entry) {
      throw new Error(`UniProt has no entry ${params.accession}`)
    }
    const name = `${entry.id}_query`
    scope.act(() => {
      self.setQuerySeqName(name)
    })
    return { sequence: entry.sequence, name }
  }
  throw new Error(
    'No query: a search needs a proteinSequence, a UniProt accession, or a connectedTranscript to translate',
  )
}

interface SearchOutcome {
  fasta: string
  treeMetadata: Record<string, Record<string, string>>
  rid?: string
  queryRow?: string
  warnings?: string[]
}

async function search({
  self,
  scope,
  query,
  querySeqName,
  maxHits,
  key,
}: {
  self: JBrowsePluginMsaViewModel
  scope: LaunchScope
  query: string
  querySeqName: string
  maxHits: number
  key: string
}): Promise<SearchOutcome> {
  const params = self.blastParams!
  const { onProgress, onRid, signal } = scope
  const { hits, queryRow, rid } = await searchBackends[
    params.searchProgram ?? 'blastp'
  ]({
    query,
    database: params.blastDatabase,
    maxHits,
    onProgress,
    onRid,
    signal,
  })
  if (hits.length === 0) {
    throw new Error('No hits found')
  }

  onProgress('Fetching species taxonomy info...')
  const nameFailures: unknown[] = []
  const taxonomyInfo = await fetchTaxonomyInfo(
    hits.map(h => h.taxid).filter((t): t is number => t !== undefined),
    signal,
    e => {
      nameFailures.push(e)
    },
  )
  const { msa: fasta, treeMetadata } = buildSearchMsa({
    hits,
    query,
    queryRow,
    taxonomyInfo,
    querySeqName,
  })
  // rows named without NCBI's answer are not worth reusing for a week
  const namesFailed = nameFailures.length > 0
  if (!queryRow && !namesFailed) {
    await saveSearch({ id: key, fasta, treeMetadata, rid })
  }
  return {
    fasta,
    treeMetadata,
    rid,
    queryRow,
    warnings: namesFailed
      ? [
          'NCBI did not answer for some species names, so those rows are named by scientific name alone.',
        ]
      : [],
  }
}

/**
 * A similarity search, then an alignment of what it found. The program is a
 * backend behind one interface (utils/homologSearch.ts); what differs between
 * them is settled by whether the result came back aligned. A program that
 * aligns as it searches (phmmer) hands over the alignment and the tree is
 * built from it in the browser; one that does not (blastp) hands over bare
 * hits and the chosen aligner runs on them.
 */
export async function doLaunchBlast({
  self,
  scope,
}: {
  self: JBrowsePluginMsaViewModel
  scope: LaunchScope
}): Promise<LaunchedData> {
  const params = self.blastParams!
  const {
    selectedTranscript,
    maxHits = defaultMaxHits,
    searchProgram = 'blastp',
  } = params
  const msaAlgorithm = params.msaAlgorithm ?? 'browser'
  const { sequence: query, name: querySeqName } = await resolveQuery(
    self,
    scope,
  )
  if (searchProgram === 'blastp' && msaAlgorithm === 'browser') {
    checkPairSize(querySeqName, query.length, query.length)
  }
  const { onProgress, signal } = scope
  const key = searchKey({
    searchProgram,
    database: params.blastDatabase,
    maxHits,
    querySeqName,
    query,
  })
  const found = await getCachedSearch(key)
  if (found) {
    onProgress(
      `Reusing the ${searchProgram} search from ${new Date(found.timestamp).toLocaleString()}...`,
    )
  }
  const { fasta, treeMetadata, rid, queryRow, warnings }: SearchOutcome =
    found ?? (await search({ self, scope, query, querySeqName, maxHits, key }))
  const { msa, tree } = queryRow
    ? { msa: fasta, tree: '' }
    : await launchMSA({
        algorithm: msaAlgorithm,
        sequence: fasta,
        onProgress,
        signal,
      })

  const transcript = transcriptFields(selectedTranscript)
  const treeMetadataJson = JSON.stringify(treeMetadata)
  await saveBlastResult({
    proteinSequence: query,
    blastDatabase: params.blastDatabase,
    msaAlgorithm: queryRow ? undefined : msaAlgorithm,
    searchProgram: params.searchProgram,
    maxHits,
    msa,
    tree,
    treeMetadata: treeMetadataJson,
    rid: rid ?? '',
    geneId: str(transcript.parentId),
    transcriptId: str(transcript.uniqueId),
    transcriptName: transcriptName(selectedTranscript),
    geneName: str(transcript.gene_name) ?? str(transcript.parentId),
  })

  return { msa, tree, treeMetadata: treeMetadataJson, warnings }
}
