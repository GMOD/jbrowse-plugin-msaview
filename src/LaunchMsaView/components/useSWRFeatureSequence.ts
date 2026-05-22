import { getSession } from '@jbrowse/core/util'
import useSWR from 'swr'

import { fetchSeq } from './fetchSeq'
import { staticSwrConfig } from '../../utils/swrConfig'

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
  const args =
    feature && assemblyName ? { feature, assemblyName, view } : undefined
  const { data, error } = useSWR(
    args ? [args.feature.id(), args.assemblyName, 'feature-sequence'] : null,
    () => featureSequenceFetcher(args!),
    staticSwrConfig,
  )

  return {
    sequence: data,
    error,
  }
}
