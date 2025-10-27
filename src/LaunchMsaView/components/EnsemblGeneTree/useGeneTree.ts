import useSWR from 'swr'

import { geneTreeFetcher } from './ensemblGeneTreeUtils'

export function useGeneTree(geneId: string) {
  const { data, error, isLoading } = useSWR(
    () => (geneId ? ['geneTree', geneId] : null),
    ([, geneId]) => geneTreeFetcher(geneId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  )

  return { treeData: data, isTreeLoading: isLoading, treeError: error }
}
