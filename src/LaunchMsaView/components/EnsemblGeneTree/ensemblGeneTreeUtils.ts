import { fetchWithLocalStorageCache, jsonfetch, textfetch } from './util'

interface TreeNodeSequence {
  mol_seq: {
    seq: string
    location?: string
  }
  id: {
    accession: string
  }[]
}

interface TreeNodeTaxonomy {
  common_name: string
  scientific_name: string
}

// This is a self-referential tree data structure
interface TreeNode {
  children?: TreeNode[]
  sequence?: TreeNodeSequence
  taxonomy: TreeNodeTaxonomy
}

interface TreeRow {
  id: string
  seq: string
  species: string
  genomicLocString?: string
}

function gatherSequencesFromTree(tree: TreeNode, arr: TreeRow[] = []) {
  if (tree.children) {
    for (const child of tree.children) {
      if (child.sequence) {
        const id = child.sequence.id[0]?.accession
        if (id) {
          arr.push({
            id,
            seq: child.sequence.mol_seq.seq,
            species:
              child.taxonomy.common_name || child.taxonomy.scientific_name,
            genomicLocString: child.sequence.mol_seq.location,
          })
        }
      }
      gatherSequencesFromTree(child, arr)
    }
  }
  return arr
}

const base = 'https://rest.ensembl.org'

export async function geneTreeFetcher(id2: string) {
  const id = id2.replace(/\..*/, '')
  const { species } = await fetchWithLocalStorageCache(`${id}-ensembl`, () =>
    jsonfetch<any>(`${base}/lookup/id/${id}?content-type=application/json`),
  )
  const treeBase = `${base}/genetree/member/id/${species}/${id}`
  const msa = await fetchWithLocalStorageCache(`${id}-msa`, () =>
    jsonfetch<{ tree: TreeNode }>(
      `${treeBase}?content-type=application/json;aligned=1;sequence=pep`,
    ),
  )

  const tree = await fetchWithLocalStorageCache<string>(`${id}-tree`, () =>
    textfetch(`${treeBase}?nh_format=simple;content-type=text/x-nh`),
  )

  const res = gatherSequencesFromTree(msa.tree)
  return {
    tree,
    msa: res.map(r => `>${r.id}\n${r.seq}`).join('\n'),
    treeMetadata: JSON.stringify(
      Object.fromEntries(res.map(r => [r.id, { genome: r.species }] as const)),
    ),
  }
}
