import { textfetch, timeout } from './fetch'

import type { MsaAlgorithm } from '../LaunchMsaView/components/NCBIBlastQuery/consts'

const base = `https://www.ebi.ac.uk/Tools/services/rest`

const algorithms: Record<
  MsaAlgorithm,
  {
    params: Record<string, string>
    msaResult: string
    treeResult: string
  }
> = {
  clustalo: {
    params: { email: 'colin.diesh@gmail.com' },
    msaResult: 'aln-clustal_num',
    treeResult: 'phylotree',
  },
  muscle: {
    params: { email: 'colin.diesh@gmail.com', format: 'clw', tree: 'tree1' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
  kalign: {
    params: { email: 'colin.diesh@gmail.com', stype: 'protein' },
    msaResult: 'fa',
    treeResult: 'phylotree',
  },
  mafft: {
    params: { email: 'colin.diesh@gmail.com', stype: 'protein' },
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    for (let i = 0; i < 10; i++) {
      await timeout(1000)
      onProgress(`Re-checking MSA status in... ${10 - i}`)
    }
    const result = await textfetch(`${base}/${algorithm}/status/${jobId}`)

    if (result === 'FINISHED') {
      break
    } else if (result.includes('FAILURE')) {
      throw new Error(`Failed to run: jobId ${jobId}`)
    }
  }
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
