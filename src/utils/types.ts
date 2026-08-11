export interface BlastHitDescription {
  accession: string
  id: string
  sciname: string
  taxid?: number
  title?: string
}

/**
 * The shape utils/ebiBlast.ts normalizes EBI's hits into. It keeps the field
 * names NCBI's JSON2 used, so everything downstream of the search — row naming,
 * taxonomy lookup, the MSA — was left untouched when the backend moved.
 */
export interface BlastHit {
  description: BlastHitDescription[]
  hsps: { hseq: string }[]
}
