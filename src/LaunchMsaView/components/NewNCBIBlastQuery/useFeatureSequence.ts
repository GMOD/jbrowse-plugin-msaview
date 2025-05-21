import { useEffect, useState } from 'react'

import { getSession } from '@jbrowse/core/util'

import { fetchSeq } from './fetchSeq'

import type { Feature } from '@jbrowse/core/util'
import type { SeqState } from './types'

export interface ErrorState {
  error: string
}
const BPLIMIT = 500_000

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
