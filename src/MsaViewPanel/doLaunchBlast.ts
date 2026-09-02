import { makeId, strip } from '../LaunchMsaView/components/util'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import { saveBlastResult } from '../utils/blastCache'
import { queryEbiBlast } from '../utils/ebiBlast'
import { launchMSA, launchTree } from '../utils/msa'
import { buildPhmmerMsa, buildRowMetadata } from '../utils/msaRows'
import { queryPhmmer } from '../utils/phmmer'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'

import type {
  BlastDatabase,
  MsaAlgorithm,
  PhmmerDatabase,
} from '../LaunchMsaView/components/BlastQuery/consts'
import type { JBrowsePluginMsaViewModel } from './model'
import type { LaunchScope } from './runLaunch'

type TreeMetadata = Record<string, Record<string, string>>

export async function doLaunchBlast({
  self,
  scope,
}: {
  self: JBrowsePluginMsaViewModel
  scope: LaunchScope
}) {
  // kept whole rather than destructured: the database's type depends on
  // searchProgram, and pulling the two apart loses the link between them
  const params = self.blastParams!
  const { selectedTranscript } = params
  const cleanedSeq = cleanProteinSequence(params.proteinSequence)
  const { onProgress, onRid, signal } = scope

  const { msa, tree, treeMetadata, rid } =
    params.searchProgram === 'phmmer'
      ? await runPhmmer({
          query: cleanedSeq,
          database: params.blastDatabase,
          onProgress,
          onRid,
          signal,
        })
      : await runBlast({
          query: cleanedSeq,
          blastDatabase: params.blastDatabase,
          msaAlgorithm: params.msaAlgorithm,
          onProgress,
          onRid,
          signal,
        })

  const treeMetadataJson = JSON.stringify(treeMetadata)

  await saveBlastResult({
    proteinSequence: cleanedSeq,
    blastDatabase: params.blastDatabase,
    msaAlgorithm: params.msaAlgorithm,
    searchProgram: params.searchProgram,
    msa,
    tree,
    treeMetadata: treeMetadataJson,
    rid,
    geneId: selectedTranscript?.get('parentId'),
    transcriptId: selectedTranscript?.id(),
    transcriptName:
      selectedTranscript?.get('name') ?? selectedTranscript?.get('id'),
    geneName:
      selectedTranscript?.get('gene_name') ??
      selectedTranscript?.get('parentId'),
  })

  return { msa, tree, treeMetadata: treeMetadataJson }
}

/**
 * BLAST returns each hit already aligned to the query, but pairwise and one hit
 * at a time, so the alignments are stripped back off and every hit is realigned
 * together by a dedicated aligner.
 */
async function runBlast({
  query,
  blastDatabase,
  msaAlgorithm,
  onProgress,
  onRid,
  signal,
}: {
  query: string
  blastDatabase: BlastDatabase
  msaAlgorithm: MsaAlgorithm
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
  signal?: AbortSignal
}) {
  const { hits, rid } = await queryEbiBlast({
    query,
    blastDatabase,
    onProgress,
    onRid,
    signal,
  })

  onProgress('Fetching species taxonomy info...')
  const taxonomyInfo = await fetchTaxonomyInfo(
    hits
      .map(h => h.description[0]?.taxid)
      .filter((t): t is number => t !== undefined),
  )

  const treeMetadata: TreeMetadata = {}
  const sequences = hits.map(h => {
    const desc = h.description[0] ?? {
      accession: 'unknown',
      id: 'unknown',
      sciname: 'unknown',
    }
    const rowName = makeId(desc, taxonomyInfo)
    treeMetadata[rowName] = buildRowMetadata(desc, taxonomyInfo)
    return `>${rowName}\n${strip(h.hsps[0]?.hseq ?? '')}`
  })

  const result = await launchMSA({
    algorithm: msaAlgorithm,
    sequence: [`>QUERY\n${query}`, ...sequences].join('\n'),
    onProgress,
    signal,
  })
  return { ...result, treeMetadata, rid }
}

/**
 * phmmer aligns every hit to a profile of the query as it searches, so its own
 * output is the MSA and there is no realignment step — the hits keep the
 * placement HMMER gave them, and the query row is derived from the alignment's
 * match columns rather than being aligned back in afterwards. That leaves no
 * aligner run to take a tree from, so the tree is built from this alignment.
 */
async function runPhmmer({
  query,
  database,
  onProgress,
  onRid,
  signal,
}: {
  query: string
  database: PhmmerDatabase
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
  signal?: AbortSignal
}) {
  const { rows, queryRow, rid } = await queryPhmmer({
    query,
    database,
    onProgress,
    onRid,
    signal,
  })

  onProgress('Fetching species taxonomy info...')
  const taxonomyInfo = await fetchTaxonomyInfo(
    rows.map(r => r.taxid).filter((t): t is number => t !== undefined),
  )

  const { msa, treeMetadata } = buildPhmmerMsa({
    rows,
    queryRow,
    taxonomyInfo,
  })
  return {
    msa,
    tree: await launchTree({ alignment: msa, onProgress, signal }),
    treeMetadata,
    rid,
  }
}
