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

/**
 * Build a tree from an alignment that already exists, which is what the phmmer
 * path needs: phmmer produces the alignment itself, so there is no aligner run
 * to take a guide tree from — and a guide tree is a byproduct of deciding
 * progressive alignment order, not a phylogeny, so it is not what we would want
 * even if there were one. simple_phylogeny is clustalw2's neighbour-joining on
 * a real distance matrix, Kimura-corrected for protein distances.
 */
export async function launchTree({
  alignment,
  onProgress,
}: {
  alignment: string
  onProgress: (arg: string) => void
}) {
  const tool = 'simple_phylogeny'
  onProgress('Building tree...')

  const jobId = await submitEbiJob({
    tool,
    params: {
      sequence: alignment,
      tree: 'phylip',
      clustering: 'Neighbour-joining',
      kimura: 'true',
    },
  })
  await waitForEbiJob({
    tool,
    jobId,
    onCountdown: s => {
      onProgress(`Re-checking tree status in... ${s}`)
    },
  })
  return fetchEbiResult({ tool, jobId, type: 'tree' })
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
