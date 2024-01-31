import { textfetch, timeout } from '../../fetchUtils'

// currently only allows clustalo, could be extended to handle more potentially
const msaAlgorithm = 'clustalo'

export async function launchMSA({
  sequence,
  onProgress,
}: {
  sequence: string
  onProgress: (arg: string) => void
}) {
  console.log({ msaAlgorithm })
  onProgress('Launching MSA')
  const jobId = await textfetch(
    `https://www.ebi.ac.uk/Tools/services/rest/${msaAlgorithm}/run`,
    {
      method: 'POST',
      body: new URLSearchParams({
        email: 'colin.diesh@gmail.com',
        sequence,
        stype: 'protein',
      }),
    },
  )

  while (true) {
    for (let i = 0; i < 10; i++) {
      await timeout(1000)
      onProgress(`Re-checking MSA status in... ${10 - i}`)
    }
    const result = await textfetch(
      `https://www.ebi.ac.uk/Tools/services/rest/${msaAlgorithm}/status/${jobId}`,
    )

    if (result === 'FINISHED') {
      break
    }
  }

  onProgress('Downloading MSA')
  const msa = await textfetch(
    `https://www.ebi.ac.uk/Tools/services/rest/${msaAlgorithm}/result/${jobId}/aln-clustal_num`,
  )
  const tree = await textfetch(
    `https://www.ebi.ac.uk/Tools/services/rest/${msaAlgorithm}/result/${jobId}/phylotree`,
  )
  return { msa, tree }
}
