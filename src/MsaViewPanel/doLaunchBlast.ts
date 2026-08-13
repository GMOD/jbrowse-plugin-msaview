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

type TreeMetadata = Record<string, Record<string, string>>

export async function doLaunchBlast({
  self,
}: {
  self: JBrowsePluginMsaViewModel
}) {
  const {
    blastDatabase,
    msaAlgorithm,
    proteinSequence,
    searchProgram,
    selectedTranscript,
  } = self.blastParams!
  const cleanedSeq = cleanProteinSequence(proteinSequence)

  const onProgress = (arg: string) => {
    self.setProgress(arg)
  }
  // publish the job id before the first poll so the view can link out while the
  // job is still running
  const onRid = (r: string) => {
    self.setRid(r)
  }

  const { msa, tree, treeMetadata, rid } =
    searchProgram === 'phmmer'
      ? await runPhmmer({
          query: cleanedSeq,
          database: blastDatabase as PhmmerDatabase,
          onProgress,
          onRid,
        })
      : await runBlast({
          query: cleanedSeq,
          blastDatabase: blastDatabase as BlastDatabase,
          msaAlgorithm: msaAlgorithm ?? 'clustalo',
          onProgress,
          onRid,
        })

  const treeMetadataJson = JSON.stringify(treeMetadata)

  await saveBlastResult({
    proteinSequence: cleanedSeq,
    blastDatabase,
    msaAlgorithm,
    searchProgram,
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
}: {
  query: string
  blastDatabase: BlastDatabase
  msaAlgorithm: MsaAlgorithm
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  const { hits, rid } = await queryEbiBlast({
    query,
    blastDatabase,
    onProgress,
    onRid,
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
}: {
  query: string
  database: PhmmerDatabase
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  const { rows, queryRow, rid } = await queryPhmmer({
    query,
    database,
    onProgress,
    onRid,
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
    tree: await launchTree({ alignment: msa, onProgress }),
    treeMetadata,
    rid,
  }
}
