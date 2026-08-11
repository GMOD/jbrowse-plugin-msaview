import { fetchEbiResult, submitEbiJob, waitForEbiJob } from './ebiJobDispatcher'

import type { MsaAlgorithm } from '../LaunchMsaView/components/BlastQuery/consts'

const algorithms: Record<
  MsaAlgorithm,
  {
    params: Record<string, string>
    msaResult: string
    treeResult: string
  }
> = {
  clustalo: {
    params: {},
    msaResult: 'aln-clustal_num',
    treeResult: 'phylotree',
  },
  muscle: {
    params: { format: 'clw', tree: 'tree1' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
  kalign: {
    params: { stype: 'protein' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
  mafft: {
    params: { stype: 'protein' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
}

export async function launchMSA({
  algorithm,
  sequence,
  onProgress,
}: {
  algorithm: MsaAlgorithm
  sequence: string
  onProgress: (arg: string) => void
}) {
  const config = algorithms[algorithm]

  onProgress(`Launching ${algorithm} MSA...`)

  const jobId = await submitEbiJob({
    tool: algorithm,
    params: { ...config.params, sequence },
  })
  await waitForEbiJob({
    tool: algorithm,
    jobId,
    onCountdown: s => {
      onProgress(`Re-checking MSA status in... ${s}`)
    },
  })
  return {
    msa: await fetchEbiResult({
      tool: algorithm,
      jobId,
      type: config.msaResult,
    }),
    tree: await fetchEbiResult({
      tool: algorithm,
      jobId,
      type: config.treeResult,
    }),
  }
}
