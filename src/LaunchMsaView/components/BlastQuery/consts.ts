/**
 * Only used to build the link-out on the manual panel, which sends the user to
 * NCBI's own site to run BLAST there. Nothing fetches this url: NCBI stopped
 * sending Access-Control-Allow-Origin to third-party origins, so a browser
 * cannot read a response from it at all. See docs/blast.md.
 */
export const BASE_BLAST_URL = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'

/** The aligners EBI's Job Dispatcher runs, each a tool name at their REST api. */
export const ebiMsaAlgorithms = [
  'clustalo',
  'muscle',
  'kalign',
  'mafft',
] as const
export type EbiMsaAlgorithm = (typeof ebiMsaAlgorithms)[number]

/**
 * `browser` is no job at all: each sequence is aligned to the query in the
 * page and the rows merged on the query (utils/browserAlign.ts), with the tree
 * built by react-msaview's neighbour joining. It is the aligner for a launch
 * that must not depend on EBI, and for one that wants to be quick -- a
 * hundred 400-residue rows take under a second, and a hundred 1400-residue
 * rows eight, against a Job Dispatcher queue that has been measured at
 * anything from ten seconds to fifteen minutes. Past the per-sequence limit in
 * browserAlign.ts it refuses and names an EBI aligner instead.
 */
export const msaAlgorithms = [...ebiMsaAlgorithms, 'browser'] as const
export type MsaAlgorithm = (typeof msaAlgorithms)[number]

export const msaAlgorithmLabels: Record<MsaAlgorithm, string> = {
  clustalo: 'Clustal Omega (EBI)',
  muscle: 'MUSCLE (EBI)',
  kalign: 'Kalign (EBI)',
  mafft: 'MAFFT (EBI)',
  browser: 'in browser, query-anchored',
}

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
const defaultBlastDatabase: BlastDatabase = 'uniprotkb_swissprot'

export const searchPrograms = ['blastp', 'phmmer'] as const
export type SearchProgram = (typeof searchPrograms)[number]

export const searchProgramLabels: Record<SearchProgram, string> = {
  blastp: 'blastp (sequence search)',
  phmmer: 'phmmer (profile HMM search)',
}

/**
 * phmmer offers PDB, AlphaFold, Ensembl Genomes, MEROPS and ChEMBL too, but
 * targets outside UniProt carry no species in their description, so those rows
 * would lose their species and common name. Only the databases that label their
 * hits are offered.
 *
 * rp15..rp75 are the Representative Proteomes: UniProt's reference proteomes
 * thinned so that no two are more than 15% (35%, 55%, 75%) similar, which is
 * the widest taxonomic spread per hit that any of these databases gives. rp15
 * is the one to reach for when the question is "what is this like across all
 * of life"; swissprot when it is "what is this like in the curated set".
 */
export const phmmerDatabaseOptions = [
  'swissprot',
  'uniprotkb',
  'uniprotrefprot',
  'rp75',
  'rp55',
  'rp35',
  'rp15',
] as const
export type PhmmerDatabase = (typeof phmmerDatabaseOptions)[number]

const defaultPhmmerDatabase: PhmmerDatabase = 'swissprot'

/**
 * The hit counts EBI's ncbiblast accepts for `alignments` and `scores`. A value
 * off this list is a 400 at submit time, so a request is rounded up to the next
 * one on it.
 */
const blastHitCounts = [5, 10, 20, 50, 100, 150, 200, 250, 500, 750, 1000]

export const defaultMaxHits = 100

export function snapBlastHitCount(maxHits: number) {
  return blastHitCounts.find(n => n >= maxHits) ?? blastHitCounts.at(-1)!
}

/**
 * A program together with a database that program actually has.
 *
 * The pair travels as one value because neither service knows the other's
 * database names — `swissprot` is a phmmer database and `uniprotkb_swissprot` a
 * blastp one — so a program held apart from its database can drift into a
 * combination EBI answers with a 400, minutes after the user pressed Submit.
 */
export type SearchChoice =
  | { program: 'blastp'; database: BlastDatabase }
  | { program: 'phmmer'; database: PhmmerDatabase }

export function defaultSearchFor(program: SearchProgram): SearchChoice {
  return program === 'phmmer'
    ? { program, database: defaultPhmmerDatabase }
    : { program, database: defaultBlastDatabase }
}

export function databaseOptionsFor(program: SearchProgram) {
  return program === 'phmmer' ? phmmerDatabaseOptions : blastDatabaseOptions
}

/**
 * What each database is called in the menu. The keys are what EBI is sent and
 * are not negotiable; `uniprotkb_swissprot` and `swissprot` are the same
 * collection under each service's own name, so they read the same here.
 */
const databaseLabels: Record<BlastDatabase | PhmmerDatabase, string> = {
  uniprotkb_swissprot: 'UniProtKB/Swiss-Prot (curated)',
  swissprot: 'UniProtKB/Swiss-Prot (curated)',
  uniprotkb: 'UniProtKB (all entries)',
  uniprotkb_trembl: 'UniProtKB/TrEMBL (unreviewed)',
  pan_proteomes: 'Pan-proteomes',
  uniprotrefprot: 'UniProt reference proteomes',
  rp75: 'Representative proteomes, 75%',
  rp55: 'Representative proteomes, 55%',
  rp35: 'Representative proteomes, 35%',
  rp15: 'Representative proteomes, 15% (widest spread)',
}

export function databaseLabel(database: BlastDatabase | PhmmerDatabase) {
  return databaseLabels[database]
}
