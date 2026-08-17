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

import { NCBI_EMAIL, NCBI_TOOL, efetchPost } from './eutils'
import { jsonfetch, textfetch } from './fetch'

// v2, not v2alpha: the alpha path still answers /orthologs but 404s
// /product_report, so an assembler pointed at it silently resolves zero
// representative proteins and reports "no orthologs" for every gene.
const DATASETS = 'https://api.ncbi.nlm.nih.gov/datasets/v2'
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

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

function ncbiUrl(url: string) {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}tool=${NCBI_TOOL}&email=${encodeURIComponent(NCBI_EMAIL)}`
}

/**
 * A free-text gene reference -> NCBI gene id. A bare number is taken as the id
 * itself; anything else is searched as a gene name within the query taxon.
 * Several candidate identifiers are tried in order, because a JBrowse feature
 * carries whatever its GFF/BigBed had — `id()`, `name`, `gene_name` — and only
 * some of those are real symbols.
 */
export async function resolveGeneId(
  candidates: string[],
  taxId: number,
): Promise<{ geneId: string; matched: string } | undefined> {
  for (const raw of candidates) {
    const query = raw.trim()
    if (!query) {
      continue
    }
    if (/^\d+$/.test(query)) {
      return { geneId: query, matched: query }
    }
    // strip a version suffix (NM_000546.6) and any GFF ID prefix (gene:TP53)
    const cleaned = query.replace(/^\w+:/, '').replace(/\.\d+$/, '')
    const term = `${cleaned}[Gene Name] AND ${taxId}[taxid]`
    const json = await jsonfetch<{
      esearchresult?: { idlist?: string[] }
    }>(
      ncbiUrl(
        `${EUTILS}/esearch.fcgi?db=gene&term=${encodeURIComponent(term)}&retmode=json&retmax=1`,
      ),
    )
    const geneId = json.esearchresult?.idlist?.[0]
    if (geneId) {
      return { geneId, matched: cleaned }
    }
  }
  return undefined
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
 * taxon, which the QUERY row already represents.
 */
export async function fetchOrthologGenes(
  geneId: string,
  {
    taxa,
    exclude,
    limit = defaultMaxSpecies,
  }: { taxa?: Set<number>; exclude?: number; limit?: number } = {},
) {
  const json = await jsonfetch<OrthologReport>(
    ncbiUrl(
      `${DATASETS}/gene/id/${geneId}/orthologs?returned_content=COMPLETE`,
    ),
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
export async function fetchRepresentativeProteins(geneIds: string[]) {
  const byGene = new Map<string, string>()
  for (let i = 0; i < geneIds.length; i += PRODUCT_REPORT_CHUNK) {
    const chunk = geneIds.slice(i, i + PRODUCT_REPORT_CHUNK)
    const json = await jsonfetch<ProductReport>(
      ncbiUrl(
        `${DATASETS}/gene/id/${chunk.join(',')}/product_report?page_size=${chunk.length}`,
      ),
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
 * get a numeric suffix rather than silently overwriting a row.
 */
export function dedupeLabels(names: string[]) {
  const seen = new Map<string, number>()
  return names.map(name => {
    const base = sanitize(name) || 'row'
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}_${n + 1}`
  })
}

/**
 * The representative protein for a single gene, with its sequence. Used to
 * decide whether the user's own translated transcript is byte-identical to the
 * RefSeq protein — if it is, that accession's precomputed CDD domains apply to
 * the query row exactly, and if it isn't, they would land at an offset.
 */
export async function fetchProteinForGene(geneId: string) {
  const acc = (await fetchRepresentativeProteins([geneId])).get(geneId)
  if (!acc) {
    return undefined
  }
  const seq = parseFasta(
    await textfetch(
      ncbiUrl(
        `${EUTILS}/efetch.fcgi?db=protein&id=${acc}&rettype=fasta&retmode=text`,
      ),
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
}: {
  geneId: string
  taxa?: Set<number>
  exclude?: number
  limit?: number
  onProgress: (arg: string) => void
}): Promise<OrthologRow[]> {
  onProgress('Finding orthologs across species...')
  const genes = await fetchOrthologGenes(geneId, { taxa, exclude, limit })
  if (genes.length < 2) {
    throw new Error(
      `Only ${genes.length} ortholog(s) found for this gene — not enough to align`,
    )
  }

  onProgress('Selecting a representative protein per species...')
  const proteinByGene = await fetchRepresentativeProteins(
    genes.map(g => g.geneId),
  )
  const withProtein = genes.filter(g => proteinByGene.has(g.geneId))
  if (withProtein.length < 2) {
    throw new Error(
      'Could not resolve representative proteins for the orthologs',
    )
  }

  onProgress(`Fetching ${withProtein.length} protein sequences...`)
  const accessions = withProtein.map(g => proteinByGene.get(g.geneId)!)
  const seqByAcc = parseFasta(
    await textfetch(
      ...efetchPost({
        db: 'protein',
        id: accessions.join(','),
        rettype: 'fasta',
        retmode: 'text',
      }),
    ),
  )

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
