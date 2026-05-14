export const BASE_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'

export const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const
export type MsaAlgorithm = (typeof msaAlgorithms)[number]

export const blastDatabaseOptions = ['nr', 'nr_cluster_seq'] as const
export type BlastDatabase = (typeof blastDatabaseOptions)[number]

export const blastPrograms = ['blastp', 'quick-blastp'] as const
export type BlastProgram = (typeof blastPrograms)[number]
