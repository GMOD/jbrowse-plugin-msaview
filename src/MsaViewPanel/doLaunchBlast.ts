import { JBrowsePluginMsaViewModel } from './model'
import { makeId, strip } from '../LaunchMsaView/components/util'
import { cleanProteinSequence } from '../LaunchMsaView/util'
import { launchMSA } from '../utils/msa'
import { queryBlast } from '../utils/ncbiBlast'

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
  } = self.blastParams!
  const cleanedSeq = cleanProteinSequence(proteinSequence)
  const { hits } = await queryBlast({
    query: cleanedSeq,
    blastDatabase,
    blastProgram,
    baseUrl,
    onProgress: arg => {
      self.setProgress(arg)
    },
    onRid: rid => {
      self.setRid(rid)
    },
  })

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
