import type { TreeNode, TreeRow } from './types'

export function gatherSequencesFromTree(tree: TreeNode, arr: TreeRow[] = []) {
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
