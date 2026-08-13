/**
 * Only used to build the link-out on the manual panel, which sends the user to
 * NCBI's own site to run BLAST there. Nothing fetches this url: NCBI stopped
 * sending Access-Control-Allow-Origin to third-party origins, so a browser
 * cannot read a response from it at all. See docs/blast.md.
 */
export const BASE_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'

export const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const
export type MsaAlgorithm = (typeof msaAlgorithms)[number]

/**
 * EBI rejects a submission naming a database outside its own list with a 400,
 * so every value here has to appear in
 * https://www.ebi.ac.uk/Tools/services/rest/ncbiblast/parameterdetails/database
 * -- `uniprotkb_reference_proteomes` did not, and 3.0.0 shipped it as a dead
 * menu entry.
 */
export const blastDatabaseOptions = [
  'uniprotkb_swissprot',
  'uniprotkb',
  'pan_proteomes',
  'uniprotkb_trembl',
] as const
export type BlastDatabase = (typeof blastDatabaseOptions)[number]

// curated, so it returns roughly one good sequence per species rather than the
// many near-identical TrEMBL entries an alignment reads poorly
export const defaultBlastDatabase: BlastDatabase = 'uniprotkb_swissprot'

export const searchPrograms = ['blastp', 'phmmer'] as const
export type SearchProgram = (typeof searchPrograms)[number]

export const defaultSearchProgram: SearchProgram = 'blastp'

/**
 * phmmer offers PDB, AlphaFold, Ensembl Genomes, MEROPS and ChEMBL too, but
 * targets outside UniProt carry no OS=/OX= in their description, so those rows
 * would lose their species and common name. Only the databases that label their
 * hits are offered.
 */
export const phmmerDatabaseOptions = [
  'swissprot',
  'uniprotkb',
  'uniprotrefprot',
] as const
export type PhmmerDatabase = (typeof phmmerDatabaseOptions)[number]

export const defaultPhmmerDatabase: PhmmerDatabase = 'swissprot'

export function defaultDatabaseFor(program: SearchProgram) {
  return program === 'phmmer' ? defaultPhmmerDatabase : defaultBlastDatabase
}

export function databaseOptionsFor(program: SearchProgram) {
  return program === 'phmmer' ? phmmerDatabaseOptions : blastDatabaseOptions
}
