import { getConf } from '@jbrowse/core/configuration'

import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * A contig's NCBI translation table, which v5 assemblies publish and v4 ones do
 * not: the config slot and the method both arrived with core 5, so an older
 * host answers undefined and the caller falls back to the standard code.
 */
interface AssemblyGeneticCode {
  getGeneticCodeId?: (refName: string) => number
}

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
  return {
    seq: (feats[0]?.get('seq') as string | undefined) ?? '',
    // travels with the sequence because the caller needs both to translate, and
    // resolving the assembly twice to get them is the shape that lost it
    assemblyGeneticCodeId: geneticCodeId(assembly, refName),
  }
}

function geneticCodeId(assembly: AssemblyGeneticCode, refName: string) {
  return assembly.getGeneticCodeId?.(refName)
}
