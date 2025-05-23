import { gatherSequencesFromTree } from './gatherSequencesFromTree'
import { TreeNode } from './types'
import { fetchWithLocalStorageCache, jsonfetch, textfetch } from './util'

const base = 'https://rest.ensembl.org'

export async function geneTreeFetcher(id2: string) {
  const id = id2.replace(/\..*/, '')
  const { species } = await fetchWithLocalStorageCache(`${id}-ensembl`, () =>
    jsonfetch<{ species: string }>(
      `${base}/lookup/id/${id}?content-type=application/json`,
    ),
  )
  const treeBase = `${base}/genetree/member/id/${species}/${id}`
  const geneTreeResult = await fetchWithLocalStorageCache(`${id}-msa`, () =>
    jsonfetch<{ tree: TreeNode; id: string }>(
      `${treeBase}?content-type=application/json;aligned=1;sequence=pep`,
    ),
  )

  // we query again to get newick format tree. could probably extract from json
  // as alternative
  const tree = await fetchWithLocalStorageCache<string>(`${id}-tree`, () =>
    textfetch(`${treeBase}?nh_format=simple;content-type=text/x-nh`),
  )

  const res = gatherSequencesFromTree(geneTreeResult.tree)
  return {
    geneTreeId: geneTreeResult.id,
    tree,
    msa: res.map(r => `>${r.id}\n${r.seq}`).join('\n'),
    treeMetadata: JSON.stringify(
      Object.fromEntries(
        res.map(
          r =>
            [
              r.id,
              {
                genome: r.species,
              },
            ] as const,
        ),
      ),
    ),
  }
}
