export const BASE_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'

export const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const
export type MsaAlgorithm = (typeof msaAlgorithms)[number]

/**
 * Which service runs the search.
 *
 * 'ebi' is the default because NCBI's Blast.cgi stopped sending
 * `Access-Control-Allow-Origin` to third-party origins, so a browser cannot
 * read its responses at all — see docs/blast.md. 'ncbi' remains selectable
 * because it still works through a proxy, which the BLAST base url setting
 * exists to point at.
 */
export const blastServices = ['ebi', 'ncbi'] as const
export type BlastService = (typeof blastServices)[number]

export const blastServiceLabels: Record<BlastService, string> = {
  ebi: 'EBI (UniProtKB)',
  ncbi: 'NCBI (needs proxy)',
}

export const ncbiBlastDatabaseOptions = ['nr', 'nr_cluster_seq'] as const
export type NcbiBlastDatabase = (typeof ncbiBlastDatabaseOptions)[number]

export const ebiBlastDatabaseOptions = [
  'uniprotkb_swissprot',
  'uniprotkb',
  'uniprotkb_reference_proteomes',
  'uniprotkb_trembl',
] as const
export type EbiBlastDatabase = (typeof ebiBlastDatabaseOptions)[number]

export type BlastDatabase = NcbiBlastDatabase | EbiBlastDatabase

export const blastDatabaseOptions: Record<
  BlastService,
  readonly BlastDatabase[]
> = {
  ebi: ebiBlastDatabaseOptions,
  ncbi: ncbiBlastDatabaseOptions,
}

export const defaultBlastDatabase: Record<BlastService, BlastDatabase> = {
  // curated, so it returns one high-quality sequence per species rather than
  // the many near-identical TrEMBL entries an MSA reads poorly
  ebi: 'uniprotkb_swissprot',
  ncbi: 'nr',
}

export function isEbiBlastDatabase(db: BlastDatabase): db is EbiBlastDatabase {
  return (ebiBlastDatabaseOptions as readonly string[]).includes(db)
}

/** EBI's ncbiblast exposes no quick-blastp equivalent, so this is NCBI-only. */
export const blastPrograms = ['blastp', 'quick-blastp'] as const
export type BlastProgram = (typeof blastPrograms)[number]
