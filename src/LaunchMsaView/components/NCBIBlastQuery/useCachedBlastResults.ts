import useSWR from 'swr'

import {
  clearAllCachedResults,
  deleteCachedResult,
  getAllCachedResults,
} from '../../../utils/blastCache'
import { staticSwrConfig } from '../../../utils/swrConfig'

export function useCachedBlastResults(geneIds: string[]) {
  const {
    data: results,
    error,
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

  const handleClearAll = async () => {
    await clearAllCachedResults()
    await mutate([], false)
  }

  return {
    results: results ?? [],
    error,
    isLoading: !results && !error,
    handleDelete,
    handleClearAll,
  }
}
