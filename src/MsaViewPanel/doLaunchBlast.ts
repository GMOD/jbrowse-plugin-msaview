import { makeId, strip } from '../LaunchMsaView/components/util'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import { saveBlastResult } from '../utils/blastCache'
import { queryEbiBlast } from '../utils/ebiBlast'
import { launchMSA } from '../utils/msa'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'

import type { JBrowsePluginMsaViewModel } from './model'
import type { TaxonomyInfo } from '../utils/taxonomyNames'
import type { BlastHitDescription } from '../utils/types'

export async function doLaunchBlast({
  self,
}: {
  self: JBrowsePluginMsaViewModel
}) {
  const { blastDatabase, msaAlgorithm, proteinSequence, selectedTranscript } =
    self.blastParams!
  const cleanedSeq = cleanProteinSequence(proteinSequence)

  const onProgress = (arg: string) => {
    self.setProgress(arg)
  }

  const { hits, rid } = await queryEbiBlast({
    query: cleanedSeq,
    blastDatabase,
    onProgress,
    // publish the job id before the first poll so the view can link out while
    // the job is still running
    onRid: r => {
      self.setRid(r)
    },
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
    blastDatabase,
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
