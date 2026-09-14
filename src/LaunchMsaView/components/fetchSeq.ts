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
  const sessionId = 'getSequence'
  // a named object keeps sessionId, which v4 hosts read from the args
  const args = {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    sessionId,
    regions: [
      {
        start,
        end,
        refName: assembly.getCanonicalRefName(refName) ?? refName,
        assemblyName,
      },
    ],
  }
  const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', args)
  return (feats[0]?.get('seq') as string | undefined) ?? ''
}
