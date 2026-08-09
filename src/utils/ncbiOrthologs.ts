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

import { NCBI_EMAIL, NCBI_TOOL } from './eutils'
import { jsonfetch, textfetch } from './fetch'

// v2, not v2alpha: the alpha path still answers /orthologs but 404s
// /product_report, so an assembler pointed at it silently resolves zero
// representative proteins and reports "no orthologs" for every gene.
const DATASETS = 'https://api.ncbi.nlm.nih.gov/datasets/v2'
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

// The species panel offered in the launch dialog, ordered from the reference
// outward so a run that finds only close relatives still reads as a ladder.
// Orthologs absent for a given gene are skipped rather than erroring.
//
// The index order is the order the sequences are SUBMITTED in
// (`COMMON_TAX_RANK` below sorts `fetchOrthologGenes`' return), not the order the
// rows are drawn in: the view lays rows out by the guide tree the aligner returns,
// so a run on this list comes out grouped by relatedness rather than by this
// list's own sequence. Reordering here changes what Clustal is handed, not the
// picture.
//
// THE MAMMALS EARN THEIR PLACE, and the reason is measured rather than aesthetic.
// The thirteen this list used to hold were one per major clade, which reads well
// on a gene conserved to yeast and produces almost nothing on a gene that is not:
// NCBI publishes 165 orthologs for human NLRP1 and every one of them is a mammal,
// so of the old thirteen only Human, Mouse, Cow, Pig and Dog returned a row --
// five, and Rat not among them, since NLRP1 is absent in Rattus norvegicus. The
// same query against this list returns twelve. An inflammasome gene is not an
// unusual case; anything immune, reproductive or lineage-specific behaves the
// same way, and those are the genes a person opens an ortholog alignment on.
//
// Cat, rabbit and opossum are here despite contributing nothing to that gene.
// They are the three that most often separate "absent in this clade" from
// "absent in this species", which is the question a gap in the alignment raises.
//
// The cost is the run, and it is roughly linear: one NCBI protein fetch per
// species and a Clustal Omega job over what comes back, so ~23 rows is about
// twice the ~13-row wait. Still seconds rather than the minutes BLAST takes,
// which is the comparison the panel's own text makes.
export const COMMON_SPECIES = [
  { label: 'Human', taxId: 9606 },
  { label: 'Chimpanzee', taxId: 9598 },
  { label: 'Gorilla', taxId: 9595 },
  { label: 'Rhesus macaque', taxId: 9544 },
  { label: 'Marmoset', taxId: 9483 },
  { label: 'Mouse', taxId: 10090 },
  { label: 'Rat', taxId: 10116 },
  { label: 'Guinea pig', taxId: 10141 },
  { label: 'Rabbit', taxId: 9986 },
  { label: 'Cat', taxId: 9685 },
  { label: 'Dog', taxId: 9615 },
  { label: 'Horse', taxId: 9796 },
  { label: 'Pig', taxId: 9823 },
  { label: 'Cow', taxId: 9913 },
  { label: 'Sheep', taxId: 9940 },
  { label: 'Opossum', taxId: 13616 },
  { label: 'Chicken', taxId: 9031 },
  { label: 'Frog', taxId: 8364 },
  { label: 'Zebrafish', taxId: 7955 },
  { label: 'Fruitfly', taxId: 7227 },
  { label: 'C. elegans', taxId: 6239 },
  { label: 'Yeast', taxId: 4932 },
  { label: 'Arabidopsis', taxId: 3702 },
] as const

export const COMMON_TAX_RANK = new Map(
  COMMON_SPECIES.map((s, i) => [s.taxId as number, i]),
)

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

/** One ortholog gene per species, restricted to the requested taxa. */
export async function fetchOrthologGenes(geneId: string, taxa: Set<number>) {
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
    if (gene?.gene_id && taxa.has(taxId) && !byTaxon.has(taxId)) {
      byTaxon.set(taxId, {
        taxId,
        geneId: gene.gene_id,
        scientificName: gene.taxname ?? String(taxId),
        commonName: gene.common_name,
      })
    }
  }
  return [...byTaxon.values()].sort(
    (a, b) =>
      (COMMON_TAX_RANK.get(a.taxId) ?? Infinity) -
      (COMMON_TAX_RANK.get(b.taxId) ?? Infinity),
  )
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

/**
 * geneId -> representative protein accession: MANE Select where flagged, else
 * the longest isoform. A stable, comparable choice across species — picking
 * "the first" would silently vary with NCBI's ordering.
 */
export async function fetchRepresentativeProteins(geneIds: string[]) {
  const byGene = new Map<string, string>()
  if (geneIds.length > 0) {
    const json = await jsonfetch<ProductReport>(
      ncbiUrl(`${DATASETS}/gene/id/${geneIds.join(',')}/product_report`),
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
  onProgress,
}: {
  geneId: string
  taxa: Set<number>
  onProgress: (arg: string) => void
}): Promise<OrthologRow[]> {
  onProgress('Finding orthologs across species...')
  const genes = await fetchOrthologGenes(geneId, taxa)
  if (genes.length < 2) {
    throw new Error(
      `Only ${genes.length} ortholog(s) found among the selected species — not enough to align`,
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
      ncbiUrl(
        `${EUTILS}/efetch.fcgi?db=protein&id=${accessions.join(',')}&rettype=fasta&retmode=text`,
      ),
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
