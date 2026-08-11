export interface BlastHitDescription {
  accession: string
  id: string
  sciname: string
  taxid?: number
  title?: string
}

/**
 * The shape both BLAST backends normalize to. NCBI's JSON2 already looks like
 * this; the EBI backend maps onto it (see utils/ebiBlast.ts) so everything
 * downstream of the search — row naming, taxonomy lookup, the MSA — is
 * backend-agnostic.
 */
export interface BlastHit {
  description: BlastHitDescription[]
  hsps: { hseq: string }[]
}

export interface BlastResults {
  BlastOutput2: {
    report: {
      results: {
        search: {
          hits: BlastHit[]
        }
      }
    }
  }[]
}
