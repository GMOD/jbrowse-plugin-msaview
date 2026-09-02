// The second ortholog source, for the genes NCBI's ortholog sets leave out.
//
// NCBI Datasets computes orthologs for vertebrates and insects, so a yeast,
// worm or plant gene comes back with orthologs only in its own clade, and a fly
// gene gets insects and nothing else. PANTHER's ortholog sets span its 144
// reference proteomes, human to yeast to Arabidopsis, and one `matchortho` call
// answers "this gene's ortholog in every genome" with a UniProt accession per
// target. Sequences come from one UniProt batch call. Both hosts send
// `Access-Control-Allow-Origin: *`. The measurements that picked PANTHER over
// OMA, OrthoDB and Ensembl are in react-msaview's
// agent-docs/ideas/ortholog-sources-beyond-ncbi.md.
//
// Rows come out in the same shape as ncbiOrthologs.ts's, so the launch, the
// labels, the aligner and the CDD overlay do not know which source ran.
// `protein` is the UniProt accession; efetch serves UniProt accessions as
// GenPept records with CDD Region features, so the overlay attaches as it does
// to a RefSeq accession.

import { jsonfetch } from './fetch'
import {
  cleanGeneCandidate,
  dedupeLabels,
  defaultMaxSpecies,
} from './ncbiOrthologs'
import { fetchTaxonomyInfo } from './taxonomyNames'

import type { OrthologRow } from './ncbiOrthologs'

const PANTHER = 'https://pantherdb.org/services/oai/pantherdb'
const UNIPROT = 'https://rest.uniprot.org/uniprotkb'

export interface PantherGenome {
  /** PANTHER's organism code, e.g. HUMAN, DROME */
  code: string
  taxId: number
  /** short common name, e.g. fruit_fly */
  name: string
  /** scientific name */
  longName: string
}

interface GenomesResponse {
  search?: {
    output?: {
      genomes?: {
        genome?: {
          short_name?: string
          taxon_id?: number
          name?: string
          long_name?: string
        }[]
      }
    }
  }
}

/**
 * `supportedgenomes` -> the code<->taxon map every other parse needs. PANTHER
 * names organisms by code only in ortholog results.
 */
export function parseGenomes(json: unknown): PantherGenome[] {
  const list = (json as GenomesResponse).search?.output?.genomes?.genome ?? []
  return list.flatMap(g =>
    g.short_name && g.taxon_id
      ? [
          {
            code: g.short_name,
            taxId: g.taxon_id,
            name: g.name ?? g.short_name,
            longName: g.long_name ?? g.short_name,
          },
        ]
      : [],
  )
}

export interface PantherGene {
  code: string
  /** UniProt accession */
  accession: string
  /** the source database's own id, e.g. HGNC=1773, FlyBase=FBgn0016131 */
  geneRef: string
}

export interface PantherHit extends PantherGene {
  symbol?: string
  /**
   * LDO = least diverged ortholog, PANTHER's pick of the one-to-one; O = any
   * other ortholog in a one-to-many or many-to-many family
   */
  type: 'LDO' | 'O'
}

interface Mapping {
  id?: string
  gene?: string
  target_gene?: string
  target_gene_symbol?: string | number
  ortholog?: string
}

interface MatchResponse {
  search?: {
    mapping?: {
      /** one object for a single (or empty) match, an array otherwise */
      mapped?: Mapping | Mapping[]
      unmapped_ids?: unknown
    }
  }
}

// "HUMAN|HGNC=1773|UniProtKB=P11802" -> { code, geneRef, accession }
function parseGeneRef(ref: string | undefined): PantherGene | undefined {
  const [code, ...xrefs] = (ref ?? '').split('|')
  const accession = xrefs
    .find(x => x.startsWith('UniProtKB='))
    ?.slice('UniProtKB='.length)
  const geneRef = xrefs.find(x => !x.startsWith('UniProtKB=')) ?? accession
  return code && accession && geneRef ? { code, accession, geneRef } : undefined
}

/**
 * `matchortho` -> the query gene (PANTHER names it in every row) and one hit
 * per target gene. An unknown gene comes back under `unmapped_ids`; a gene with
 * no ortholog in the target set comes back as a bare `{ id }`.
 */
export function parseMatches(json: unknown): {
  unmapped: boolean
  query?: PantherGene
  hits: PantherHit[]
} {
  const mapping = (json as MatchResponse).search?.mapping
  const mapped = mapping?.mapped
  const rows = Array.isArray(mapped) ? mapped : mapped ? [mapped] : []
  const hits: PantherHit[] = []
  let query: PantherGene | undefined
  for (const row of rows) {
    query ??= parseGeneRef(row.gene)
    const target = parseGeneRef(row.target_gene)
    if (target && (row.ortholog === 'LDO' || row.ortholog === 'O')) {
      hits.push({
        ...target,
        symbol:
          row.target_gene_symbol === undefined
            ? undefined
            : String(row.target_gene_symbol),
        type: row.ortholog,
      })
    }
  }
  return { unmapped: !!mapping?.unmapped_ids, query, hits }
}

/**
 * One hit per organism, in first-seen order: the LDO where PANTHER named one,
 * else the first other ortholog it listed. A many-to-many family (the Hox
 * genes) has no LDO at all, so dropping to "first O" is what keeps those
 * species in the alignment.
 */
export function pickOnePerGenome(hits: PantherHit[]): PantherHit[] {
  const byCode = new Map<string, PantherHit>()
  for (const hit of hits) {
    const current = byCode.get(hit.code)
    if (!current || (current.type === 'O' && hit.type === 'LDO')) {
      byCode.set(hit.code, hit)
    }
  }
  return [...byCode.values()]
}

interface UniProtResponse {
  results?: {
    primaryAccession?: string
    sequence?: { value?: string }
  }[]
}

/** `uniprotkb/accessions` -> accession -> sequence */
export function parseSequences(json: unknown): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of (json as UniProtResponse).results ?? []) {
    if (r.primaryAccession && r.sequence?.value) {
      map.set(r.primaryAccession, r.sequence.value)
    }
  }
  return map
}

let genomes: Promise<PantherGenome[]> | undefined

/** The proteome list, fetched once per page and forgotten on failure. */
export function fetchGenomes() {
  genomes ??= jsonfetch(`${PANTHER}/supportedgenomes`)
    .then(parseGenomes)
    .catch((e: unknown) => {
      genomes = undefined
      throw e
    })
  return genomes
}

// UniProt caps one `accessions` call at 100 ids
const UNIPROT_CHUNK = 100

async function fetchSequences(accessions: string[]) {
  const map = new Map<string, string>()
  for (let i = 0; i < accessions.length; i += UNIPROT_CHUNK) {
    const chunk = accessions.slice(i, i + UNIPROT_CHUNK)
    const json = await jsonfetch(
      `${UNIPROT}/accessions?accessions=${chunk.join(',')}&fields=accession,sequence&format=json`,
    )
    for (const [acc, seq] of parseSequences(json)) {
      map.set(acc, seq)
    }
  }
  return map
}

/**
 * One `matchortho` per candidate until PANTHER maps one. A JBrowse feature
 * carries whatever its GFF/BigBed had — `id()`, `name`, `gene_name` — and only
 * some of those are names PANTHER knows. `targets` omitted asks for every
 * genome PANTHER has, which is one call rather than one per genome.
 */
async function matchOrthologs(
  candidates: string[],
  taxId: number,
  targets: PantherGenome[] | undefined,
) {
  let matched: string | undefined
  for (const raw of candidates) {
    const query = cleanGeneCandidate(raw)
    if (!query) {
      continue
    }
    const params = new URLSearchParams({
      geneInputList: query,
      organism: String(taxId),
      orthologType: 'all',
    })
    if (targets) {
      params.set('targetOrganism', targets.map(t => t.taxId).join(','))
    }
    const parsed = parseMatches(
      await jsonfetch(`${PANTHER}/ortholog/matchortho?${params.toString()}`),
    )
    if (!parsed.unmapped) {
      matched ??= query
      if (parsed.query) {
        return { ...parsed, matched: query }
      }
    }
  }
  return matched === undefined
    ? undefined
    : { matched, hits: [], query: undefined }
}

export interface PantherOrthologs {
  /** the candidate PANTHER recognised */
  matched: string
  /** the query gene as PANTHER knows it, with its UniProt sequence */
  query?: PantherGene & { sequence: string }
  rows: OrthologRow[]
}

/**
 * The whole PANTHER half of the pipeline: gene -> ortholog rows carrying
 * labels, accessions and sequences, plus the query gene's own protein for the
 * query row. Two lookups (genomes, orthologs), one taxonomy batch for the
 * labels, one UniProt batch for the sequences.
 *
 * `taxa`, `exclude` and `limit` mean what they mean for fetchOrthologRows:
 * `taxa` narrows the targets (omitted, every genome PANTHER has, in its order),
 * `exclude` drops the query taxon, `limit` caps the rows before their
 * sequences are fetched.
 */
export async function fetchPantherOrthologs({
  candidates,
  taxId,
  taxa,
  exclude,
  limit = defaultMaxSpecies,
  onProgress,
}: {
  candidates: string[]
  taxId: number
  taxa?: Set<number>
  exclude?: number
  limit?: number
  onProgress: (arg: string) => void
}): Promise<PantherOrthologs> {
  const all = await fetchGenomes()
  const byTaxId = new Map(all.map(g => [g.taxId, g]))
  const byCode = new Map(all.map(g => [g.code, g]))
  const queryGenome = byTaxId.get(taxId)
  if (!queryGenome) {
    throw new Error(
      `PANTHER has no reference proteome for taxon ${taxId}. NCBI orthologs cover vertebrates and insects; try that source.`,
    )
  }
  const targets = taxa
    ? [...taxa].flatMap(t => {
        const g = byTaxId.get(t)
        return g && t !== exclude ? [g] : []
      })
    : undefined

  onProgress('Matching orthologs at PANTHER...')
  const match = await matchOrthologs(candidates, taxId, targets)
  if (!match) {
    throw new Error(
      `PANTHER has no entry for ${candidates.join(', ')} in ${queryGenome.longName}. Try the NCBI BLAST tab, which needs no gene identifier.`,
    )
  }

  const rank = new Map(targets?.map((t, i) => [t.taxId, i]))
  const picks = pickOnePerGenome(match.hits)
    .map(hit => ({ hit, genome: byCode.get(hit.code) }))
    .filter(
      (p): p is { hit: PantherHit; genome: PantherGenome } =>
        !!p.genome &&
        p.genome.taxId !== exclude &&
        (targets ? rank.has(p.genome.taxId) : true),
    )
    .sort((a, b) =>
      targets ? rank.get(a.genome.taxId)! - rank.get(b.genome.taxId)! : 0,
    )
    .slice(0, limit)
  if (picks.length < 2) {
    throw new Error(
      `Only ${picks.length} PANTHER ortholog(s) found for ${match.matched} — not enough to align`,
    )
  }

  onProgress(`Fetching ${picks.length} protein sequences from UniProt...`)
  const [names, sequences] = await Promise.all([
    taxonomyNames(picks.map(p => p.genome.taxId)),
    fetchSequences([
      ...(match.query ? [match.query.accession] : []),
      ...picks.map(p => p.hit.accession),
    ]),
  ])

  const described = picks.map(({ hit, genome }) => {
    const info = names.get(genome.taxId)
    return {
      hit,
      genome,
      name: info ? (info.commonName ?? info.sciname) : genome.name,
      scientificName: info?.sciname || genome.longName,
      commonName: info?.commonName,
    }
  })
  const labels = dedupeLabels(described.map(d => d.name))
  const rows = described
    .map(({ hit, genome, scientificName, commonName }, i) => ({
      taxId: genome.taxId,
      label: labels[i]!,
      scientificName,
      commonName,
      geneId: hit.geneRef,
      protein: hit.accession,
      sequence: sequences.get(hit.accession) ?? '',
    }))
    .filter(r => r.sequence)
  if (rows.length < 2) {
    throw new Error('Could not fetch protein sequences for the orthologs')
  }

  const querySequence = match.query && sequences.get(match.query.accession)
  return {
    matched: match.matched,
    query:
      match.query && querySequence
        ? { ...match.query, sequence: querySequence }
        : undefined,
    rows,
  }
}

/**
 * NCBI's names for the taxa, so PANTHER rows are labelled exactly as NCBI rows
 * are. A failed lookup only costs the labels, which fall back to PANTHER's own
 * short names, so it is logged rather than thrown.
 */
async function taxonomyNames(taxIds: number[]) {
  try {
    return await fetchTaxonomyInfo(taxIds)
  } catch (e) {
    console.warn('[msaview-orthologs] taxonomy name lookup failed:', e)
    return new Map<number, { sciname: string; commonName?: string }>()
  }
}
