// Homolog discovery WITHOUT a search job.
//
// The BLAST path answers "what looks like this sequence", which is not the
// question an MSA row set wants — it wants "what is homologous to this gene,
// one per species, labelled by species". BLAST then costs 10+ minutes to
// return a redundant, accession-labelled hit list that has to be deduplicated
// before it reads. NCBI has already computed the answer: the Datasets
// orthologs endpoint returns one ortholog gene per species, instantly.
//
// gene symbol -> gene id -> orthologs -> a representative protein each ->
// sequences, all from NCBI, in a handful of requests. The caller aligns them
// (EBI Clustal Omega, ~10s) and overlays CDD domains, which are already baked
// into the GenPept records (see ncbiDomains.ts).
//
// Mirrors jb2hubs' website/src/components/proteinMsa.ts assembler, trimmed to
// what the launch dialog needs and using this plugin's fetch/eutils helpers.

import {
  efetchPost,
  efetchUrl,
  eutilsJson,
  eutilsText,
  eutilsUrl,
} from './eutils'
import { HttpError, jsonfetch } from './fetch'

// v2, not v2alpha: the alpha path still answers /orthologs but 404s
// /product_report, so an assembler pointed at it silently resolves zero
// representative proteins and reports "no orthologs" for every gene.
const DATASETS = 'https://api.ncbi.nlm.nih.gov/datasets/v2'

// NCBI's ortholog report IS the species panel. There is no list here to keep in
// step with what NCBI knows, and the panel widens by itself as NCBI annotates
// more genomes.
//
// It used to be a hand-written 23-species list intersected with the report, and
// the intersection is what made the alignment thin: NCBI publishes 165 orthologs
// for human NLRP1 and 865 for CFTR, so the list kept 12 of the first and 19 of
// the second. It also carried four species -- fruitfly, yeast, C. elegans and
// arabidopsis -- that the endpoint has never once returned for a human gene:
// checked against NLRP1, TP53, ACTB, BRCA1, PIK3CA, APOE and NOTCH1, whose fly
// ortholog is famous and still absent. NCBI's ortholog sets are vertebrate
// scoped.
//
// The report's OWN order is the ladder the list was hand-built to approximate,
// and it is per gene. CFTR opens human, mouse, rat, zebrafish, pig, sheep,
// rabbit, chicken, cattle, ferret, dog, rhesus; NLRP1, which has no ortholog
// outside placental mammals, opens human, mouse, rhesus, shrew mouse, chimp,
// dog, cattle, horse. So `limit` takes a prefix and never needs a rank table.
//
// The rows are SUBMITTED in that order, not drawn in it -- the view lays rows out
// by the guide tree the aligner returns.
//
// What limits the row count is the aligner, and it is linear in rows at roughly
// half a second each for a ~1400aa protein: 165 NLRP1 orthologs align at EBI in
// 88s, 865 CFTR orthologs in 407s. `defaultMaxSpecies` keeps a default run under
// a minute; EBI's own ceiling is 4000 sequences and 4MB, which even CFTR's full
// set (1.3MB) sits inside.
export const defaultMaxSpecies = 100

export interface OrthologRow {
  taxId: number
  /** single-token id used identically in the FASTA, the tree and the domain GFF */
  label: string
  scientificName: string
  commonName?: string
  geneId: string
  /** accession.version */
  protein: string
  sequence: string
}

/**
 * A candidate gene reference as the ortholog services know it: a GFF ID prefix
 * (gene:TP53) and a version suffix (NM_000546.6) stripped off. Shared with
 * pantherOrthologs, which asks PANTHER the same question with the same
 * candidates.
 */
export function cleanGeneCandidate(raw: string) {
  return raw
    .trim()
    .replace(/^\w+:/, '')
    .replace(/\.\d+$/, '')
}

export interface SymbolCandidate {
  gene_id?: string
  symbol?: string
  synonyms?: string[]
}

/**
 * NCBI's symbol lookups match aliases as well as symbols and rank neither
 * first: `TTN` in human answers TTR (transthyretin, whose alias it is) ahead of
 * titin, from Datasets and from an esearch `[Gene Name]` alike. Case decides
 * before a case-blind match, because fly `Dl` (Delta) and `dl` (dorsal) differ
 * by it alone. The first hit stands when nothing matches, which is what keeps
 * an alias like `p53` working. The same rule as jb2hubs' orthologSet.ts.
 */
export function pickBySymbol(query: string, candidates: SymbolCandidate[]) {
  const lower = query.toLowerCase()
  const exact =
    candidates.find(c => c.symbol === query) ??
    candidates.find(c => c.synonyms?.includes(query)) ??
    candidates.find(c => c.symbol?.toLowerCase() === lower)
  return (exact ?? candidates[0])?.gene_id
}

/** Datasets answers an unknown symbol with `{}` and an unroutable one with a 404 */
async function symbolCandidates(
  symbol: string,
  taxId: number,
  signal?: AbortSignal,
) {
  try {
    const json = await jsonfetch<{ reports?: { gene?: SymbolCandidate }[] }>(
      `${DATASETS}/gene/symbol/${encodeURIComponent(symbol)}/taxon/${taxId}`,
      { signal },
    )
    return (json.reports ?? []).flatMap(r => (r.gene ? [r.gene] : []))
  } catch (e) {
    if (e instanceof HttpError && (e.status === 400 || e.status === 404)) {
      return []
    }
    throw e
  }
}

async function searchGeneName(
  name: string,
  taxId: number,
  signal?: AbortSignal,
) {
  const json = await eutilsJson<{
    esearchresult?: { idlist?: string[] }
  }>(
    eutilsUrl('esearch', {
      db: 'gene',
      term: `${name}[Gene Name] AND ${taxId}[taxid]`,
      retmode: 'json',
      retmax: '1',
    }),
    { signal },
  )
  return json.esearchresult?.idlist?.[0]
}

/**
 * A free-text gene reference -> NCBI gene id. Several candidate identifiers
 * are tried in order, because a JBrowse feature carries whatever its GFF/BigBed
 * had — `id()`, `name`, `gene_name` — and only some of those are real symbols.
 * `gene:TP53` and `TP53` are one search. Each is asked of Datasets, whose
 * candidates `pickBySymbol` ranks, and then of esearch, which also reaches
 * descriptions.
 *
 * A bare number is taken as the id itself only when no name resolves, since
 * nothing checks whose gene it is: a GFF `ID=12345` beside `Name=TP53` would
 * otherwise align some other organism's orthologs.
 */
export async function resolveGeneId(
  candidates: string[],
  taxId: number,
  signal?: AbortSignal,
): Promise<{ geneId: string; matched: string } | undefined> {
  const asked = new Set<string>()
  const queries = candidates.map(c => c.trim())
  const isId = (query: string) => /^\d+$/.test(query)
  for (const query of queries.filter(q => !isId(q))) {
    const cleaned = cleanGeneCandidate(query)
    if (!cleaned || asked.has(cleaned)) {
      continue
    }
    asked.add(cleaned)
    const geneId =
      pickBySymbol(cleaned, await symbolCandidates(cleaned, taxId, signal)) ??
      (await searchGeneName(cleaned, taxId, signal))
    if (geneId) {
      return { geneId, matched: cleaned }
    }
  }
  const id = queries.find(isId)
  return id ? { geneId: id, matched: id } : undefined
}

interface OrthologReport {
  reports?: {
    gene?: {
      gene_id?: string
      tax_id?: string | number
      taxname?: string
      common_name?: string
    }
  }[]
}

/**
 * One ortholog gene per species, in NCBI's report order, capped at `limit`.
 *
 * `taxa` narrows the set when a caller wants specific species; omitted, every
 * species NCBI has an ortholog for is a candidate. `exclude` drops the query
 * taxon, which already has its own `<species>_query` row.
 */
export async function fetchOrthologGenes(
  geneId: string,
  {
    taxa,
    exclude,
    limit = defaultMaxSpecies,
    signal,
  }: {
    taxa?: Set<number>
    exclude?: number
    limit?: number
    signal?: AbortSignal
  } = {},
) {
  const json = await jsonfetch<OrthologReport>(
    `${DATASETS}/gene/id/${geneId}/orthologs?returned_content=COMPLETE`,
    { signal },
  )
  const byTaxon = new Map<
    number,
    {
      taxId: number
      geneId: string
      scientificName: string
      commonName?: string
    }
  >()
  for (const { gene } of json.reports ?? []) {
    const taxId = Number(gene?.tax_id)
    if (
      gene?.gene_id &&
      taxId !== exclude &&
      (taxa?.has(taxId) ?? true) &&
      !byTaxon.has(taxId)
    ) {
      byTaxon.set(taxId, {
        taxId,
        geneId: gene.gene_id,
        scientificName: gene.taxname ?? String(taxId),
        commonName: gene.common_name,
      })
    }
    if (byTaxon.size >= limit) {
      break
    }
  }
  return [...byTaxon.values()]
}

interface ProductReport {
  reports?: {
    product?: {
      gene_id?: string
      transcripts?: {
        select_category?: string
        protein?: { accession_version?: string; length?: number }
      }[]
    }
  }[]
}

// Two ceilings sit between a gene id list and its product report, and both fail
// by returning less rather than by erroring, so a caller that ignores them just
// draws a thinner alignment.
//
// The ids go in the URL PATH, and NCBI answers HTTP 414 above roughly 8KB of
// them -- CFTR's 865 orthologs join to 8609 characters and 414 on the nose.
// `PRODUCT_REPORT_CHUNK` keeps a request well inside that.
//
// Then the endpoint paginates at 20 with the count in `total_count` and the rest
// behind `next_page_token`, which is invisible to a caller reading `reports`.
// `page_size` covers a chunk in one request. The old 23-species panel never
// reached this: the query taxon is excluded and NCBI has no ortholog for the
// four invertebrate entries, so its ceiling was 19.
const PRODUCT_REPORT_CHUNK = 150

/**
 * geneId -> representative protein accession: MANE Select where flagged, else
 * the longest isoform. A stable, comparable choice across species — picking
 * "the first" would silently vary with NCBI's ordering.
 */
export async function fetchRepresentativeProteins(
  geneIds: string[],
  signal?: AbortSignal,
) {
  const byGene = new Map<string, string>()
  for (let i = 0; i < geneIds.length; i += PRODUCT_REPORT_CHUNK) {
    const chunk = geneIds.slice(i, i + PRODUCT_REPORT_CHUNK)
    const json = await jsonfetch<ProductReport>(
      `${DATASETS}/gene/id/${chunk.join(',')}/product_report?page_size=${chunk.length}`,
      { signal },
    )
    for (const { product } of json.reports ?? []) {
      const candidates = (product?.transcripts ?? [])
        .map(t => ({
          acc: t.protein?.accession_version,
          len: t.protein?.length ?? 0,
          mane: /select/i.test(t.select_category ?? ''),
        }))
        .filter(
          (c): c is { acc: string; len: number; mane: boolean } => !!c.acc,
        )
      const best =
        candidates.find(c => c.mane) ??
        [...candidates].sort((a, b) => b.len - a.len).at(0)
      if (product?.gene_id && best) {
        byGene.set(product.gene_id, best.acc)
      }
    }
  }
  return byGene
}

/** accession (first header token) -> ungapped sequence, from a multi-FASTA. */
export function parseFasta(text: string) {
  const map = new Map<string, string>()
  let acc: string | undefined
  let buf: string[] = []
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      if (acc) {
        map.set(acc, buf.join(''))
      }
      acc = line.slice(1).split(/\s+/)[0]
      buf = []
    } else {
      buf.push(line.trim())
    }
  }
  if (acc) {
    map.set(acc, buf.join(''))
  }
  return map
}

function sanitize(name: string) {
  return name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Sanitized, unique single-token labels used identically in the FASTA headers,
 * the tree leaf names and the domain GFF seq_ids — that identity is how the
 * viewer pairs a tree leaf to its alignment row to its domain track. Collisions
 * get a numeric suffix rather than silently overwriting a row, and the suffix
 * climbs past labels already emitted: a species genuinely named `human_2` would
 * otherwise take the label the second `human` is about to get, merging two rows
 * into one.
 */
export function dedupeLabels(names: string[]) {
  const used = new Set<string>()
  return names.map(name => {
    const base = sanitize(name) || 'row'
    let label = base
    let n = 1
    while (used.has(label)) {
      n += 1
      label = `${base}_${n}`
    }
    used.add(label)
    return label
  })
}

/**
 * The representative protein for a single gene, with its sequence. Used to
 * decide whether the user's own translated transcript is byte-identical to the
 * RefSeq protein — if it is, that accession's precomputed CDD domains apply to
 * the query row exactly, and if it isn't, they would land at an offset.
 */
export async function fetchProteinForGene(
  geneId: string,
  signal?: AbortSignal,
) {
  const acc = (await fetchRepresentativeProteins([geneId], signal)).get(geneId)
  if (!acc) {
    return undefined
  }
  const seq = parseFasta(
    await eutilsText(
      efetchUrl({ db: 'protein', id: acc, rettype: 'fasta', retmode: 'text' }),
      { signal },
    ),
  ).get(acc)
  return seq ? { accession: acc, sequence: seq } : undefined
}

/**
 * The whole NCBI half of the pipeline: gene -> ortholog rows carrying labels,
 * accessions and sequences. Everything here is a precomputed lookup, so this
 * returns in seconds rather than the 10+ minutes a BLAST submission costs.
 */
export async function fetchOrthologRows({
  geneId,
  taxa,
  exclude,
  limit,
  onProgress,
  signal,
}: {
  geneId: string
  taxa?: Set<number>
  exclude?: number
  limit?: number
  onProgress: (arg: string) => void
  signal?: AbortSignal
}): Promise<OrthologRow[]> {
  onProgress('Finding orthologs across species...')
  const genes = await fetchOrthologGenes(geneId, {
    taxa,
    exclude,
    limit,
    signal,
  })
  if (genes.length < 2) {
    throw new Error(
      `Only ${genes.length} ortholog(s) found for this gene — not enough to align`,
    )
  }

  onProgress('Selecting a representative protein per species...')
  const proteinByGene = await fetchRepresentativeProteins(
    genes.map(g => g.geneId),
    signal,
  )
  const withProtein = genes.filter(g => proteinByGene.has(g.geneId))
  if (withProtein.length < 2) {
    throw new Error(
      'Could not resolve representative proteins for the orthologs',
    )
  }

  onProgress(`Fetching ${withProtein.length} protein sequences...`)
  const accessions = withProtein.map(g => proteinByGene.get(g.geneId)!)
  const [efetch, init] = efetchPost({
    db: 'protein',
    id: accessions.join(','),
    rettype: 'fasta',
    retmode: 'text',
  })
  const seqByAcc = parseFasta(await eutilsText(efetch, { ...init, signal }))

  const labels = dedupeLabels(
    withProtein.map(g => g.commonName ?? g.scientificName),
  )
  const rows = withProtein
    .map((g, i) => {
      const protein = proteinByGene.get(g.geneId)!
      return {
        taxId: g.taxId,
        label: labels[i]!,
        scientificName: g.scientificName,
        commonName: g.commonName,
        geneId: g.geneId,
        protein,
        sequence: seqByAcc.get(protein) ?? '',
      }
    })
    .filter(r => r.sequence)
  if (rows.length < 2) {
    throw new Error('Could not fetch protein sequences for the orthologs')
  }
  return rows
}
