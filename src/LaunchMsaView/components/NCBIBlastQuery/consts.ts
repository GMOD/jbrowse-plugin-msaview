export const BASE_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'
export const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const
export type MsaAlgorithm = (typeof msaAlgorithms)[number]
