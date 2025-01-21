import { useEffect, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { AbstractSessionModel, Feature, getSession } from '@jbrowse/core/util'

export interface SeqState {
  seq: string
  upstream?: string
  downstream?: string
}

export interface ErrorState {
  error: string
}
const BPLIMIT = 500_000

async function fetchSeq({
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
  const feats = (await rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig: getConf(assembly, ['sequence', 'adapter']),
    sessionId,
    regions: [
      {
        start,
        end,
        refName: assembly.getCanonicalRefName(refName),
        assemblyName,
      },
    ],
  })) as Feature[]
  return (feats[0]?.get('seq') as string | undefined) ?? ''
}

export function useFeatureSequence({
  view,
  feature,
  upDownBp = 0,
  forceLoad = true,
}: {
  view: { assemblyNames?: string[] } | undefined
  feature: Feature
  upDownBp?: number
  forceLoad?: boolean
}) {
  const [sequence, setSequence] = useState<SeqState | ErrorState>()
  const [error, setError] = useState<unknown>()
  const assemblyName = view?.assemblyNames?.[0]
  useEffect(() => {
    if (view) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
        try {
          setError(undefined)
          setSequence(undefined)
          const session = getSession(view)
          const { start, end, refName } = feature.toJSON() as {
            start: number
            end: number
            refName: string
          }
          if (!assemblyName) {
            throw new Error('No assembly found')
          }
          if (!forceLoad && end - start > BPLIMIT) {
            setSequence({
              error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
            })
          } else {
            const b = start - upDownBp
            const e = end + upDownBp
            setSequence({
              seq: await fetchSeq({
                start,
                end,
                refName,
                assemblyName,
                session,
              }),
              upstream: await fetchSeq({
                start: Math.max(0, b),
                end: start,
                refName,
                assemblyName,
                session,
              }),
              downstream: await fetchSeq({
                start: end,
                end: e,
                refName,
                assemblyName,
                session,
              }),
            })
          }
        } catch (e) {
          console.error(e)
          setError(e)
        }
      })()
    }
  }, [feature, view, upDownBp, assemblyName, forceLoad])
  return { sequence, error }
}
