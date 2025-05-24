export interface BlastResults {
  BlastOutput2: {
    report: {
      results: {
        search: {
          hits: {
            description: { accession: string; id: string; sciname: string }[]
            hsps: { hseq: string }[]
          }[]
        }
      }
    }
  }[]
}
