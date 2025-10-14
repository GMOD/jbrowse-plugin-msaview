import { getSession } from '@jbrowse/core/util'
import useSWR from 'swr'

import { fetchSeq } from './fetchSeq'

import type { SeqState } from './types'
import type { Feature } from '@jbrowse/core/util'

const BPLIMIT = 500_000

async function featureSequenceFetcher({
  feature,
  assemblyName,
  upDownBp,
  view,
  forceLoad,
}: {
  feature: Feature
  assemblyName: string
  upDownBp: number
  view: { assemblyNames?: string[] }
  forceLoad: boolean
}): Promise<SeqState | undefined> {
  const session = getSession(view)
  const { start, end, refName } = feature.toJSON() as {
    start: number
    end: number
    refName: string
  }

  const b = start - upDownBp
  const e = end + upDownBp
  const [seq, upstream, downstream] = await Promise.all([
    fetchSeq({
      start,
      end,
      refName,
      assemblyName,
      session,
    }),
    fetchSeq({
      start: Math.max(0, b),
      end: start,
      refName,
      assemblyName,
      session,
    }),
    fetchSeq({
      start: end,
      end: e,
      refName,
      assemblyName,
      session,
    }),
  ])
  return { seq, upstream, downstream }
}

export function useSWRFeatureSequence({
  view,
  feature,
  upDownBp = 0,
  forceLoad = true,
}: {
  view: { assemblyNames?: string[] } | undefined
  feature?: Feature
  upDownBp?: number
  forceLoad?: boolean
}) {
  const assemblyName = view?.assemblyNames?.[0]
  const { data, error } = useSWR(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    feature && assemblyName && view
      ? [feature.id(), assemblyName, upDownBp, forceLoad, 'feature-sequence']
      : null,
    () =>
      featureSequenceFetcher({
        feature: feature!,
        assemblyName: assemblyName!,
        upDownBp,
        view: view!,
        forceLoad,
      }),
  )

  return {
    sequence: data,
    error,
  }
}
