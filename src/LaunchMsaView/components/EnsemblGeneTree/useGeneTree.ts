import { useEffect, useState } from 'react'

import { geneTreeFetcher } from './ensemblGeneTreeUtils'

type Ret = Awaited<ReturnType<typeof geneTreeFetcher>>

export function useGeneTree(geneId: string) {
  const [treeData, setTreeData] = useState<Ret>()
  const [isTreeLoading, setIsTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<unknown>()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setIsTreeLoading(true)
        const result = await geneTreeFetcher(geneId)
        setTreeData(result)
      } catch (e) {
        console.error(e)
        setTreeError(e)
      } finally {
        setIsTreeLoading(false)
      }
    })()
  }, [geneId])

  return { treeData, isTreeLoading, treeError }
}
