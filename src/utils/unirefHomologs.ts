// Homologs from UniRef, with no search job and no aligner job.
//
// UniProt has already clustered every UniProtKB sequence by identity: a
// UniRef50 cluster holds everything within 50% identity of its seed, UniRef90
// everything within 90%. So "what is like this protein, across all of
// UniProtKB" is one lookup -- the query's cluster -- and one listing of the
// cluster's members, both from rest.uniprot.org, which sends
// `Access-Control-Allow-Origin: *` and answers in a second or two. Measured
// 2026-09-05: human TP53's UniRef50 cluster has 191 UniProtKB members, 129 of
// them in a reference proteome, against a phmmer job at EBI that took 15
// minutes to answer the same question that day.
//
// What a cluster is NOT is a sensitivity search. Identity clustering stops at
// its threshold, so p53's cluster is mammals and no fish; the remote homologs
// phmmer or BLAST would reach are in other clusters. The two are complements,
// which is why both are offered.
//
// Rows come out as OrthologRow, the shape ncbiOrthologs.ts and
// pantherOrthologs.ts produce, so the launch, the labels and the aligner do not
// know which source ran. `protein` is the UniProt accession, which is what the
// CDD overlay reads through efetch (Swiss-Prot rows only; see the PANTHER note
// in DEVELOPERS.md).

import { handleFetch, jsonfetch } from './fetch'
import {
  cleanGeneCandidate,
  dedupeLabels,
  defaultMaxSpecies,
} from './ncbiOrthologs'

import type { OrthologRow } from './ncbiOrthologs'

const UNIPROT = 'https://rest.uniprot.org'

export const unirefIdentities = [50, 90] as const
export type UnirefIdentity = (typeof unirefIdentities)[number]

// the "Reference proteome" keyword, KW-1185: one well-annotated proteome per
// taxonomic neighbourhood, which is what keeps a cluster from being a hundred
// near-identical strains
const REFERENCE_PROTEOME = 'keyword:KW-1185'

// UniProt's own accession grammar, isoform suffix allowed
export const UNIPROT_ACCESSION =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-\d+)?$/

interface UniProtEntry {
  primaryAccession?: string
  uniProtkbId?: string
  entryType?: string
  organism?: {
    scientificName?: string
    commonName?: string
    taxonId?: number
  }
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } }
    submissionNames?: { fullName?: { value?: string } }[]
  }
  sequence?: { value?: string; length?: number }
}

export interface UnirefMember {
  accession: string
  id: string
  reviewed: boolean
  taxId: number
  scientificName: string
  commonName?: string
  title?: string
  sequence: string
}

const ENTRY_FIELDS =
  'accession,id,reviewed,organism_name,organism_id,protein_name,sequence'

export function parseEntry(entry: UniProtEntry): UnirefMember | undefined {
  const { primaryAccession, uniProtkbId, organism, sequence } = entry
  if (!primaryAccession || !organism?.taxonId || !sequence?.value) {
    return undefined
  }
  return {
    accession: primaryAccession,
    id: uniProtkbId ?? primaryAccession,
    reviewed: /\breviewed\b/i.test(entry.entryType ?? ''),
    taxId: organism.taxonId,
    scientificName: organism.scientificName ?? String(organism.taxonId),
    commonName: organism.commonName,
    title:
      entry.proteinDescription?.recommendedName?.fullName?.value ??
      entry.proteinDescription?.submissionNames?.[0]?.fullName?.value,
    sequence: sequence.value,
  }
}

function parseEntries(json: unknown) {
  return ((json as { results?: UniProtEntry[] }).results ?? []).flatMap(e => {
    const m = parseEntry(e)
    return m ? [m] : []
  })
}

/** A reviewed entry outranks an unreviewed one; among equals, the longest. */
function rank(a: UnirefMember, b: UnirefMember) {
  return (
    Number(b.reviewed) - Number(a.reviewed) ||
    b.sequence.length - a.sequence.length
  )
}

/**
 * The query as UniProt knows it. A candidate that already is a UniProt
 * accession is fetched directly; a gene symbol is searched in the query
 * organism, reviewed entries first.
 */
export async function resolveUniProtEntry(
  candidates: string[],
  taxId: number,
  signal?: AbortSignal,
): Promise<UnirefMember | undefined> {
  for (const raw of candidates) {
    const candidate = cleanGeneCandidate(raw)
    if (!candidate) {
      continue
    }
    if (UNIPROT_ACCESSION.test(candidate)) {
      const json = await jsonfetch(
        `${UNIPROT}/uniprotkb/${candidate.split('-')[0]}?fields=${ENTRY_FIELDS}`,
        { signal },
      )
      const entry = parseEntry(json as UniProtEntry)
      if (entry) {
        return entry
      }
      continue
    }
    const query = `gene_exact:${candidate} AND organism_id:${taxId}`
    const json = await jsonfetch(
      `${UNIPROT}/uniprotkb/search?query=${encodeURIComponent(query)}&fields=${ENTRY_FIELDS}&size=25`,
      { signal },
    )
    const [best] = parseEntries(json).sort(rank)
    if (best) {
      return best
    }
  }
  return undefined
}

/** `uniref/search` -> the id of the cluster an accession belongs to at `identity`. */
export async function fetchClusterId(
  accession: string,
  identity: UnirefIdentity,
  signal?: AbortSignal,
) {
  const query = `(uniprot_id:${accession}) AND (identity:${identity / 100})`
  const json = (await jsonfetch(
    `${UNIPROT}/uniref/search?query=${encodeURIComponent(query)}&fields=id,count&size=1`,
    { signal },
  )) as { results?: { id?: string; memberCount?: number }[] }
  const cluster = json.results?.[0]
  return cluster?.id
    ? { id: cluster.id, memberCount: cluster.memberCount }
    : undefined
}

// a page per request, followed through the Link header; the scan stops once
// enough species have been seen, so a ten-thousand-member cluster of a kinase
// domain does not have to be read to the end
const PAGE = 500
const MAX_SCANNED = 5000

function nextLink(response: Response) {
  const link = response.headers.get('link') ?? ''
  return /<([^>]+)>;\s*rel="next"/.exec(link)?.[1]
}

/**
 * The cluster's UniProtKB members, one per species: reviewed over unreviewed,
 * then longest. `taxa` narrows to those species, `exclude` drops one (the
 * query's own, which has its own row), `limit` caps the result.
 */
export async function fetchClusterMembers({
  clusterId,
  identity,
  referenceProteomesOnly = true,
  taxa,
  exclude,
  limit = defaultMaxSpecies,
  onProgress,
  signal,
}: {
  clusterId: string
  identity: UnirefIdentity
  referenceProteomesOnly?: boolean
  taxa?: Set<number>
  exclude?: number
  limit?: number
  onProgress?: (arg: string) => void
  signal?: AbortSignal
}) {
  const query = [
    `uniref_cluster_${identity}:${clusterId}`,
    ...(referenceProteomesOnly ? [REFERENCE_PROTEOME] : []),
  ].join(' AND ')
  let url: string | undefined =
    `${UNIPROT}/uniprotkb/search?query=${encodeURIComponent(query)}&fields=${ENTRY_FIELDS}&size=${PAGE}&format=json`

  const bySpecies = new Map<number, UnirefMember>()
  let scanned = 0
  let total: number | undefined
  while (url && scanned < MAX_SCANNED) {
    const response = await handleFetch(url, { signal })
    total ??= Number(response.headers.get('x-total-results')) || undefined
    const members = parseEntries(await response.json())
    scanned += members.length
    for (const member of members) {
      if (member.taxId === exclude || (taxa && !taxa.has(member.taxId))) {
        continue
      }
      const current = bySpecies.get(member.taxId)
      if (!current || rank(member, current) < 0) {
        bySpecies.set(member.taxId, member)
      }
    }
    onProgress?.(
      `Read ${scanned}${total ? ` of ${total}` : ''} cluster members, ${bySpecies.size} species...`,
    )
    // every species asked for has been seen, or the cap is met and the rest
    // of the listing could only replace picks with lower-ranked ones
    if (taxa && [...taxa].every(t => bySpecies.has(t) || t === exclude)) {
      break
    }
    url = members.length ? nextLink(response) : undefined
  }
  return {
    total,
    rows: [...bySpecies.values()].sort(rank).slice(0, limit),
  }
}

export interface UnirefHomologs {
  query: UnirefMember
  clusterId: string
  /** how many UniProtKB entries the cluster listing held before the one-per-species pick */
  total?: number
  rows: OrthologRow[]
}

/**
 * The whole UniRef half of the pipeline: gene or accession -> UniProt entry ->
 * cluster -> one member per species, carrying labels, accessions and
 * sequences. Three requests for a typical cluster, none of them a job.
 */
export async function fetchUnirefHomologs({
  candidates,
  taxId,
  identity = 50,
  referenceProteomesOnly = true,
  taxa,
  exclude,
  limit = defaultMaxSpecies,
  onProgress,
  signal,
}: {
  candidates: string[]
  taxId: number
  identity?: UnirefIdentity
  referenceProteomesOnly?: boolean
  taxa?: Set<number>
  exclude?: number
  limit?: number
  onProgress: (arg: string) => void
  signal?: AbortSignal
}): Promise<UnirefHomologs> {
  onProgress('Resolving the query at UniProt...')
  const query = await resolveUniProtEntry(candidates, taxId, signal)
  if (!query) {
    throw new Error(
      `UniProt has no entry for ${candidates.join(', ')} in taxon ${taxId}. Try the BLAST tab, which needs no gene identifier.`,
    )
  }

  onProgress(`Finding the UniRef${identity} cluster of ${query.id}...`)
  const cluster = await fetchClusterId(query.accession, identity, signal)
  if (!cluster) {
    throw new Error(`${query.accession} is in no UniRef${identity} cluster`)
  }

  const { total, rows: members } = await fetchClusterMembers({
    clusterId: cluster.id,
    identity,
    referenceProteomesOnly,
    taxa,
    exclude,
    limit,
    onProgress,
    signal,
  })
  if (members.length < 1) {
    throw new Error(
      `${cluster.id} has no other ${referenceProteomesOnly ? 'reference-proteome ' : ''}member to align ${query.id} against`,
    )
  }

  const labels = dedupeLabels(
    members.map(m => m.commonName ?? m.scientificName),
  )
  return {
    query,
    clusterId: cluster.id,
    total,
    rows: members.map((m, i) => ({
      taxId: m.taxId,
      label: labels[i]!,
      scientificName: m.scientificName,
      commonName: m.commonName,
      geneId: m.id,
      protein: m.accession,
      sequence: m.sequence,
    })),
  }
}
