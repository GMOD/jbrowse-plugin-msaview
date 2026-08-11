/**
 * Only used to build the link-out on the manual panel, which sends the user to
 * NCBI's own site to run BLAST there. Nothing fetches this url: NCBI stopped
 * sending Access-Control-Allow-Origin to third-party origins, so a browser
 * cannot read a response from it at all. See docs/blast.md.
 */
export const BASE_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'

export const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const
export type MsaAlgorithm = (typeof msaAlgorithms)[number]

export const blastDatabaseOptions = [
  'uniprotkb_swissprot',
  'uniprotkb',
  'uniprotkb_reference_proteomes',
  'uniprotkb_trembl',
] as const
export type BlastDatabase = (typeof blastDatabaseOptions)[number]

// curated, so it returns roughly one good sequence per species rather than the
// many near-identical TrEMBL entries an alignment reads poorly
export const defaultBlastDatabase: BlastDatabase = 'uniprotkb_swissprot'
