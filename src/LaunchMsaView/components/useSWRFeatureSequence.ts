import useSWR from 'swr'
import { getSession } from '@jbrowse/core/util'
import { fetchSeq } from './fetchSeq'
import type { Feature } from '@jbrowse/core/util'
import type { SeqState } from './types'

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

  if (!forceLoad && end - start > BPLIMIT) {
    return {
      error: `Genomic sequence larger than ${BPLIMIT}bp, use "force load" button to display`,
    }
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
    () =>
      feature && assemblyName && view
        ? [
            feature.id(),
            assemblyName,
            upDownBp,
            forceLoad,
            'feature-sequence',
          ]
        : null,
    () =>
      feature && assemblyName && view
        ? featureSequenceFetcher({
            feature,
            assemblyName,
            upDownBp,
            view,
            forceLoad,
          })
        : undefined,
  )

  return {
    sequence: data,
    error,
  }
}
