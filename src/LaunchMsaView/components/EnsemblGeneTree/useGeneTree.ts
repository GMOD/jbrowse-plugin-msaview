import useSWR from 'swr'
import { geneTreeFetcher } from './ensemblGeneTreeUtils'

export function useGeneTree(geneId: string) {
  const { data, error, isLoading } = useSWR(
    () => (geneId ? ['geneTree', geneId] : null),
    ([, geneId]) => geneTreeFetcher(geneId),
  )

  return { treeData: data, isTreeLoading: isLoading, treeError: error }
}