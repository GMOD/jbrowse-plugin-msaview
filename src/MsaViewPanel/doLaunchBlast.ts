import { makeId, strip } from '../LaunchMsaView/components/util'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import { saveBlastResult } from '../utils/blastCache'
import { queryEbiBlast } from '../utils/ebiBlast'
import { launchMSA, launchTree } from '../utils/msa'
import { queryPhmmer } from '../utils/phmmer'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'

import type { JBrowsePluginMsaViewModel } from './model'
import type {
  BlastDatabase,
  MsaAlgorithm,
  PhmmerDatabase,
} from '../LaunchMsaView/components/BlastQuery/consts'
import type { PhmmerRow } from '../utils/phmmer'
import type { TaxonomyInfo } from '../utils/taxonomyNames'
import type { BlastHitDescription } from '../utils/types'

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

  const treeMetadata: TreeMetadata = {}
  const rowNames = makeRowNames(rows, taxonomyInfo)
  const sequences = rows.map((row, i) => {
    const rowName = rowNames[i]!
    treeMetadata[rowName] = buildRowMetadata(row, taxonomyInfo)
    return `>${rowName}\n${row.aligned}`
  })

  const msa = [`>QUERY\n${queryRow}`, ...sequences].join('\n')
  return {
    msa,
    tree: await launchTree({ alignment: msa, onProgress }),
    treeMetadata,
    rid,
  }
}

/**
 * One target can match the query in several places and phmmer emits a row per
 * matched envelope — four for lamprey albumin against human albumin, which has
 * three domains. Those rows share an accession and so would share a name, and
 * duplicate names silently collapse rows in both the MSA and the tree, so the
 * envelope disambiguates them.
 */
function makeRowNames(
  rows: PhmmerRow[],
  taxonomyInfo: Map<number, TaxonomyInfo>,
) {
  const baseNames = rows.map(row => makeId(row, taxonomyInfo))
  const counts = new Map<string, number>()
  for (const name of baseNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const used = new Set<string>()
  return baseNames.map((base, i) => {
    let name =
      counts.get(base)! > 1 ? `${base}_${rows[i]!.range ?? i + 1}` : base
    while (used.has(name)) {
      name = `${name}_${i + 1}`
    }
    used.add(name)
    return name
  })
}

function buildRowMetadata(
  desc: BlastHitDescription,
  taxonomyInfo: Map<number, TaxonomyInfo>,
) {
  const metadata: Record<string, string> = {}
  const taxInfo = desc.taxid ? taxonomyInfo.get(desc.taxid) : undefined

  if (taxInfo?.sciname) {
    metadata['Scientific name'] = taxInfo.sciname
  }
  if (taxInfo?.commonName) {
    metadata['Common name'] = taxInfo.commonName
  }
  if (desc.accession) {
    metadata.Accession = desc.accession
  }
  if (desc.id) {
    metadata.ID = desc.id
  }
  if (desc.title) {
    metadata.Description = desc.title
  }

  return metadata
}
