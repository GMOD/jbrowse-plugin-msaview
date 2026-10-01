import { getConf } from '@jbrowse/core/configuration'

import type { AbstractSessionModel } from '@jbrowse/core/util'

export async function fetchSeq({
  start,
  end,
  refName,
  session,
  assemblyName,
}: {
  start: number
  end: number
  refName: string
  assemblyName: string
  session: AbstractSessionModel
}) {
  const { assemblyManager, rpcManager } = session
  const assembly = await assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error('assembly not found')
  }
  const feats = await rpcManager.call('getSequence', 'CoreGetFeatures', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    regions: [
      {
        start,
        end,
        refName: assembly.getCanonicalRefName(refName) ?? refName,
        assemblyName,
      },
    ],
  })
  return {
    seq: (feats[0]?.get('seq') as string | undefined) ?? '',
    // travels with the sequence because the caller needs both to translate, and
    // resolving the assembly twice to get them is the shape that lost it
    assemblyGeneticCodeId: assembly.getGeneticCodeId(refName),
  }
}
