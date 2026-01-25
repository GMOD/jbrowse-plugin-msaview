export interface BlastHitDescription {
  accession: string
  id: string
  sciname: string
  taxid?: number
  title?: string
}

export interface BlastResults {
  BlastOutput2: {
    report: {
      results: {
        search: {
          hits: {
            description: BlastHitDescription[]
            hsps: { hseq: string }[]
          }[]
        }
      }
    }
  }[]
}
