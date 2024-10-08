import { textfetch, timeout } from './fetch'

const base = `https://www.ebi.ac.uk/Tools/services/rest`

async function runClustalOmega({
  sequence,
  onProgress,
}: {
  sequence: string
  onProgress: (arg: string) => void
}) {
  const jobId = await textfetch(`${base}/clustalo/run`, {
    method: 'POST',
    body: new URLSearchParams({
      email: 'colin.diesh@gmail.com',
      sequence,
    }),
  })
  await wait({ jobId, algorithm: 'clustalo', onProgress })
  return {
    msa: await textfetch(`${base}/clustalo/result/${jobId}/aln-clustal_num`),
    tree: await textfetch(`${base}/clustalo/result/${jobId}/phylotree`),
  }
}

async function runMuscle({
  sequence,
  onProgress,
}: {
  sequence: string
  onProgress: (arg: string) => void
}) {
  const jobId = await textfetch(`${base}/muscle/run`, {
    method: 'POST',
    body: new URLSearchParams({
      email: 'colin.diesh@gmail.com',
      format: 'clw',
      tree: 'tree1',
      sequence,
    }),
  })
  await wait({ jobId, algorithm: 'muscle', onProgress })
  return {
    msa: await textfetch(`${base}/muscle/result/${jobId}/fa`),
    tree: await textfetch(`${base}/muscle/result/${jobId}/phylotree`),
  }
}

async function runKalign({
  sequence,
  onProgress,
}: {
  sequence: string
  onProgress: (arg: string) => void
}) {
  const jobId = await textfetch(`${base}/kalign/run`, {
    method: 'POST',
    body: new URLSearchParams({
      email: 'colin.diesh@gmail.com',
      stype: 'protein',
      sequence,
    }),
  })
  await wait({ jobId, algorithm: 'kalign', onProgress })
  return {
    msa: await textfetch(`${base}/kalign/result/${jobId}/fa`),
    tree: await textfetch(`${base}/kalign/result/${jobId}/phylotree`),
  }
}

async function runMafft({
  sequence,
  onProgress,
}: {
  sequence: string
  onProgress: (arg: string) => void
}) {
  const jobId = await textfetch(`${base}/mafft/run`, {
    method: 'POST',
    body: new URLSearchParams({
      email: 'colin.diesh@gmail.com',
      stype: 'protein',
      sequence,
    }),
  })
  await wait({ jobId, algorithm: 'mafft', onProgress })
  return {
    msa: await textfetch(`${base}/mafft/result/${jobId}/fa`),
    tree: await textfetch(`${base}/mafft/result/${jobId}/phylotree`),
  }
}
async function wait({
  onProgress,
  jobId,
  algorithm,
}: {
  jobId: string
  algorithm: string
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
  algorithm: string
  sequence: string
  onProgress: (arg: string) => void
}) {
  onProgress(`Launching ${algorithm} MSA...`)
  switch (algorithm) {
    case 'clustalo': {
      return runClustalOmega({ sequence, onProgress })
    }
    case 'muscle': {
      return runMuscle({ sequence, onProgress })
    }
    case 'kalign': {
      return runKalign({ sequence, onProgress })
    }
    case 'mafft': {
      return runMafft({ sequence, onProgress })
    }
    default: {
      throw new Error('unknown algorithm')
    }
  }
}
