import { getSession } from '@jbrowse/core/util'
import useSWR from 'swr'

import { fetchSeq } from './fetchSeq'

import type { Feature } from '@jbrowse/core/util'

async function featureSequenceFetcher({
  feature,
  assemblyName,
  view,
}: {
  feature: Feature
  assemblyName: string
  view: { assemblyNames?: string[] }
}) {
  const session = getSession(view)
  const { start, end, refName } = feature.toJSON() as {
    start: number
    end: number
    refName: string
  }
  const seq = await fetchSeq({
    start,
    end,
    refName,
    assemblyName,
    session,
  })
  return { seq }
}

export function useSWRFeatureSequence({
  view,
  feature,
}: {
  view: { assemblyNames?: string[] } | undefined
  feature?: Feature
}) {
  const assemblyName = view?.assemblyNames?.[0]
  const { data, error } = useSWR(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    feature && assemblyName && view
      ? [feature.id(), assemblyName, 'feature-sequence']
      : null,
    () =>
      featureSequenceFetcher({
        feature: feature!,
        assemblyName: assemblyName!,
        view: view!,
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  )

  return {
    sequence: data,
    error,
  }
}
