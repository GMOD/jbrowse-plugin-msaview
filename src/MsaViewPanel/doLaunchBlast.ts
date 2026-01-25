import { JBrowsePluginMsaViewModel } from './model'
import { makeId, strip } from '../LaunchMsaView/components/util'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import {
  getCachedBlastResult,
  saveBlastResult,
} from '../utils/blastCache'
import { launchMSA } from '../utils/msa'
import { queryBlast } from '../utils/ncbiBlast'
import { fetchCommonNames } from '../utils/taxonomyNames'

export async function doLaunchBlast({
  self,
}: {
  self: JBrowsePluginMsaViewModel
}) {
  const {
    baseUrl,
    blastDatabase,
    blastProgram,
    msaAlgorithm,
    proteinSequence,
    selectedTranscript,
  } = self.blastParams!
  const cleanedSeq = cleanProteinSequence(proteinSequence)

  const cached = await getCachedBlastResult({
    proteinSequence: cleanedSeq,
    blastDatabase,
    blastProgram,
  })

  let hits
  let rid

  if (cached) {
    self.setProgress('Using cached BLAST results...')
    hits = cached.hits
    rid = cached.rid
    self.setRid(rid)
  } else {
    const result = await queryBlast({
      query: cleanedSeq,
      blastDatabase,
      blastProgram,
      baseUrl,
      onProgress: arg => {
        self.setProgress(arg)
      },
      onRid: r => {
        self.setRid(r)
      },
    })
    hits = result.hits
    rid = result.rid

    await saveBlastResult({
      proteinSequence: cleanedSeq,
      blastDatabase,
      blastProgram,
      msaAlgorithm,
      hits,
      rid,
      geneId: selectedTranscript?.get('parentId'),
      transcriptId: selectedTranscript?.get('id'),
    })
  }

  self.setProgress('Fetching species common names...')
  const taxids: number[] = []
  for (const hit of hits) {
    const desc = hit.description[0]
    if (desc?.taxid) {
      taxids.push(desc.taxid)
    }
  }
  const commonNames = await fetchCommonNames(taxids)

  return launchMSA({
    algorithm: msaAlgorithm,
    sequence: [
      `>QUERY\n${cleanedSeq}`,
      ...hits
        .map(
          h =>
            [
              makeId(
                h.description[0] ?? {
                  accession: 'unknown',
                  id: 'unknown',
                  sciname: 'unknown',
                },
                commonNames,
              ),
              strip(h.hsps[0]?.hseq ?? ''),
            ] as const,
        )
        .map(([id, seq]) => `>${id}\n${seq}`),
    ].join('\n'),
    onProgress: arg => {
      self.setProgress(arg)
    },
  })
}
