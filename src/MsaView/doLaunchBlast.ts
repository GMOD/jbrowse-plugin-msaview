import { launchMSA } from '../LaunchMsaView/components/NewNCBIBlastQuery/msaUtils'
import { queryBlast } from '../LaunchMsaView/components/NewNCBIBlastQuery/ncbiBlastUtils'
import {
  makeId,
  strip,
} from '../LaunchMsaView/components/NewNCBIBlastQuery/util'
import { JBrowsePluginMsaViewModel } from './model'

export async function doLaunchBlast({
  self,
}: {
  self: JBrowsePluginMsaViewModel
}) {
  const {
    blastDatabase,
    blastProgram,
    msaAlgorithm,
    selectedTranscript,
    proteinSequence,
  } = self.blastParams!
  const query = proteinSequence.replaceAll('*', '').replaceAll('&', '')
  const { hits } = await queryBlast({
    query,
    blastDatabase,
    blastProgram,
    onProgress: arg => self.setProgress(arg),
    onRid: rid => self.setRid(rid),
  })

  const sequence = [
    `>QUERY\n${query}`,
    ...hits
      .map(h => [makeId(h.description[0]), strip(h.hsps[0].hseq)] as const)
      .map(([id, seq]) => `>${id}\n${seq}`),
  ].join('\n')

  const data = await launchMSA({
    algorithm: msaAlgorithm,
    sequence,
    onProgress: arg => self.setProgress(arg),
  })

  await ncbiBlastLaunchView({
    session,
    feature: selectedTranscript,
    view,
    newViewTitle: `NCBI BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)} - ${msaAlgorithm}`,
    data,
  })
}
