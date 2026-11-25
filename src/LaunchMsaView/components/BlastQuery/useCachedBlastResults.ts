import {
  deleteCachedResult,
  getAllCachedResults,
} from '../../../utils/blastCache'
import { useFetch } from '../../../utils/useFetch'
import { getGeneIdentifiers, getTranscriptFeatures } from '../../util'

import type { Feature } from '@jbrowse/core/util'

export function useCachedBlastResults(feature: Feature) {
  const {
    data: results,
    error,
    isLoading,
    mutate,
  } = useFetch(['cached-blast', feature.id()], async () => {
    const geneIds = getGeneIdentifiers(feature)
    const transcriptIds = getTranscriptFeatures(feature).map(t => t.id())
    const cached = await getAllCachedResults()
    return cached.filter(
      r =>
        (r.geneId && geneIds.includes(r.geneId)) ||
        (r.transcriptId && transcriptIds.includes(r.transcriptId)),
    )
  })

  return {
    results: results ?? [],
    error,
    isLoading,
    handleDelete: async (id: string) => {
      await deleteCachedResult(id)
      mutate()
    },
    // deletes only what this hook listed, i.e. the results for this feature.
    // The list the user is looking at is gene-scoped, so a store-wide clear here
    // would silently throw away every other gene's cached alignments too
    handleClearAll: async () => {
      await Promise.all((results ?? []).map(r => deleteCachedResult(r.id)))
      mutate()
    },
  }
}
