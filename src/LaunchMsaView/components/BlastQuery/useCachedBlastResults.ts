import useSWR from 'swr'

import {
  deleteCachedResult,
  getAllCachedResults,
} from '../../../utils/blastCache'
import { staticSwrConfig } from '../../../utils/swrConfig'

export function useCachedBlastResults(geneIds: string[]) {
  const {
    data: results,
    error,
    isLoading,
    mutate,
  } = useSWR(
    `cached-blast-${geneIds.join(',')}`,
    async () => {
      const cached = await getAllCachedResults()
      return cached.filter(r => r.geneId && geneIds.includes(r.geneId))
    },
    staticSwrConfig,
  )

  const handleDelete = async (id: string) => {
    await deleteCachedResult(id)
    await mutate(
      results => results?.filter(result => result.id !== id) ?? [],
      false,
    )
  }

  // deletes only what this hook listed, i.e. the results for these gene ids.
  // The list the user is looking at is gene-scoped, so a store-wide clear here
  // would silently throw away every other gene's cached alignments too
  const handleClearAll = async () => {
    await Promise.all((results ?? []).map(r => deleteCachedResult(r.id)))
    await mutate([], false)
  }

  return {
    results: results ?? [],
    error,
    isLoading,
    handleDelete,
    handleClearAll,
  }
}
