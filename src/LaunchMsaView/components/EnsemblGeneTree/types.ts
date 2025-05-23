export interface TreeNodeSequence {
  mol_seq: {
    seq: string
    location?: string
  }
  id: {
    accession: string
  }[]
}

export interface TreeNodeTaxonomy {
  common_name: string
  scientific_name: string
}

// This is a self-referential tree data structure
export interface TreeNode {
  children?: TreeNode[]
  sequence?: TreeNodeSequence
  taxonomy: TreeNodeTaxonomy
}

export interface TreeRow {
  id: string
  seq: string
  species: string
  genomicLocString?: string
}
