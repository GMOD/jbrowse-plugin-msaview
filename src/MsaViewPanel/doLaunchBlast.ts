import { isEbiBlastDatabase } from '../LaunchMsaView/components/NCBIBlastQuery/consts'
import { makeId, strip } from '../LaunchMsaView/components/util'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import { saveBlastResult } from '../utils/blastCache'
import { queryEbiBlast, queryEbiBlastFromJobId } from '../utils/ebiBlast'
import { launchMSA } from '../utils/msa'
import { queryBlast, queryBlastFromRid } from '../utils/ncbiBlast'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'

import type { JBrowsePluginMsaViewModel } from './model'
import type {
  BlastDatabase,
  BlastProgram,
  BlastService,
} from '../LaunchMsaView/components/NCBIBlastQuery/consts'
import type { TaxonomyInfo } from '../utils/taxonomyNames'
import type { BlastHitDescription } from '../utils/types'

/**
 * Run the search on whichever service the launch asked for. Both backends
 * return the same normalized hits, so everything after this point — taxonomy,
 * row naming, the MSA — is identical.
 */
async function runBlast({
  blastService,
  blastDatabase,
  blastProgram,
  baseUrl,
  query,
  existingRid,
  onProgress,
  onRid,
}: {
  blastService: BlastService
  blastDatabase: BlastDatabase
  blastProgram: BlastProgram
  baseUrl: string
  query: string
  existingRid?: string
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  if (blastService === 'ebi') {
    if (!isEbiBlastDatabase(blastDatabase)) {
      throw new Error(
        `EBI BLAST cannot search "${blastDatabase}", which is an NCBI database`,
      )
    }
    return existingRid
      ? queryEbiBlastFromJobId({ jobId: existingRid, onProgress })
      : queryEbiBlast({ query, blastDatabase, onProgress, onRid })
  }
  if (isEbiBlastDatabase(blastDatabase)) {
    throw new Error(
      `NCBI BLAST cannot search "${blastDatabase}", which is an EBI database`,
    )
  }
  return existingRid
    ? queryBlastFromRid({ rid: existingRid, baseUrl, onProgress })
    : queryBlast({
        query,
        blastDatabase,
        blastProgram,
        baseUrl,
        onProgress,
        onRid,
      })
}

export async function doLaunchBlast({
  self,
}: {
  self: JBrowsePluginMsaViewModel
}) {
  const {
    baseUrl,
    blastService = 'ncbi',
    blastDatabase,
    blastProgram,
    msaAlgorithm,
    proteinSequence,
    selectedTranscript,
    rid: existingRid,
  } = self.blastParams!
  const cleanedSeq = cleanProteinSequence(proteinSequence)

  const onProgress = (arg: string) => {
    self.setProgress(arg)
  }
  const onRid = (r: string) => {
    self.setRid(r)
  }

  if (existingRid) {
    // publish it before the first poll so the view can link out to the service
    // while the job is still running
    self.setRid(existingRid)
  }

  const { hits, rid } = await runBlast({
    blastService,
    blastDatabase,
    blastProgram,
    baseUrl,
    query: cleanedSeq,
    existingRid,
    onProgress,
    onRid,
  })

  self.setProgress('Fetching species taxonomy info...')
  const taxids = hits
    .map(h => h.description[0]?.taxid)
    .filter((t): t is number => t !== undefined)
  const taxonomyInfo = await fetchTaxonomyInfo(taxids)

  const treeMetadata: Record<string, Record<string, string>> = {}

  const sequences = hits.map(h => {
    const desc = h.description[0] ?? {
      accession: 'unknown',
      id: 'unknown',
      sciname: 'unknown',
    }
    const rowName = makeId(desc, taxonomyInfo)
    const seq = strip(h.hsps[0]?.hseq ?? '')

    treeMetadata[rowName] = buildRowMetadata(desc, taxonomyInfo)

    return `>${rowName}\n${seq}`
  })

  const result = await launchMSA({
    algorithm: msaAlgorithm,
    sequence: [`>QUERY\n${cleanedSeq}`, ...sequences].join('\n'),
    onProgress,
  })

  const treeMetadataJson = JSON.stringify(treeMetadata)

  await saveBlastResult({
    proteinSequence: cleanedSeq,
    blastService,
    blastDatabase,
    blastProgram,
    msaAlgorithm,
    msa: result.msa,
    tree: result.tree,
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

  return {
    ...result,
    treeMetadata: treeMetadataJson,
  }
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
