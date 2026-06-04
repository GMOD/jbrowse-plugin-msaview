import { textfetch } from './fetch'
import { pollLoop } from './poll'

import type { MsaAlgorithm } from '../LaunchMsaView/components/NCBIBlastQuery/consts'

const base = `https://www.ebi.ac.uk/Tools/services/rest`
const email = 'colin.diesh@gmail.com'

const algorithms: Record<
  MsaAlgorithm,
  {
    params: Record<string, string>
    msaResult: string
    treeResult: string
  }
> = {
  clustalo: {
    params: { email },
    msaResult: 'aln-clustal_num',
    treeResult: 'phylotree',
  },
  muscle: {
    params: { email, format: 'clw', tree: 'tree1' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
  kalign: {
    params: { email, stype: 'protein' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
  mafft: {
    params: { email, stype: 'protein' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
}

async function wait({
  onProgress,
  jobId,
  algorithm,
}: {
  jobId: string
  algorithm: MsaAlgorithm
  onProgress: (arg: string) => void
}) {
  await pollLoop({
    intervalSeconds: 10,
    onCountdown: s => {
      onProgress(`Re-checking MSA status in... ${s}`)
    },
    check: async () => {
      const result = await textfetch(`${base}/${algorithm}/status/${jobId}`)
      if (result.includes('FINISHED')) {
        return true
      }
      if (result.includes('FAILURE')) {
        throw new Error(`Failed to run: jobId ${jobId}`)
      }
      return false
    },
  })
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

  const jobId = await textfetch(`${base}/${algorithm}/run`, {
    method: 'POST',
    body: new URLSearchParams({ ...config.params, sequence }),
  })
  await wait({ jobId, algorithm, onProgress })
  return {
    msa: await textfetch(
      `${base}/${algorithm}/result/${jobId}/${config.msaResult}`,
    ),
    tree: await textfetch(
      `${base}/${algorithm}/result/${jobId}/${config.treeResult}`,
    ),
  }
}
