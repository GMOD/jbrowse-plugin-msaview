import {
  deleteCachedResult,
  getAllCachedResults,
} from '../../../utils/blastCache'
import { useFetch } from '../../../utils/useFetch'

export function useCachedBlastResults(geneIds: string[]) {
  const {
    data: results,
    error,
    isLoading,
    mutate,
  } = useFetch(`cached-blast-${geneIds.join(',')}`, async () => {
    const cached = await getAllCachedResults()
    return cached.filter(r => r.geneId && geneIds.includes(r.geneId))
  })

  return {
    results: results ?? [],
    error,
    isLoading,
    handleDelete: async (id: string) => {
      await deleteCachedResult(id)
      mutate()
    },
    // deletes only what this hook listed, i.e. the results for these gene ids.
    // The list the user is looking at is gene-scoped, so a store-wide clear here
    // would silently throw away every other gene's cached alignments too
    handleClearAll: async () => {
      await Promise.all((results ?? []).map(r => deleteCachedResult(r.id)))
      mutate()
    },
  }
}
