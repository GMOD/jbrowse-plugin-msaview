import { cleanProteinSequence } from '../LaunchMsaView/util'
import { launchMSA } from '../utils/msa'
import {
  dedupeLabels,
  fetchOrthologRows,
  fetchProteinForGene,
  resolveGeneId,
} from '../utils/ncbiOrthologs'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'

import type { JBrowsePluginMsaViewModel } from './model'
import type { OrthologRow } from '../utils/ncbiOrthologs'

/**
 * The no-search-job alternative to doLaunchBlast.
 *
 * BLAST spends 10+ minutes answering "what looks like this sequence" and
 * returns a redundant, accession-labelled hit list. This asks NCBI the question
 * the alignment actually wants — "what is this gene's ortholog in each species"
 * — which NCBI has already computed, so the whole NCBI half returns in about a
 * second and only the EBI alignment (~10s) costs real time.
 *
 * The query row is the user's OWN selected transcript, not NCBI's
 * representative protein for the query species, because `connectedFeature`
 * maps genome coordinates through that row — swapping in a different isoform
 * would silently break the genome<->MSA linkage. The query species is therefore
 * excluded from the ortholog set rather than appearing twice.
 */
export async function doLaunchOrthologs({
  self,
}: {
  self: JBrowsePluginMsaViewModel
}) {
  const {
    taxId,
    taxa,
    maxSpecies,
    geneCandidates,
    msaAlgorithm,
    proteinSequence,
  } = self.orthologParams!

  const onProgress = (arg: string) => {
    self.setProgress(arg)
  }

  onProgress('Resolving gene at NCBI...')
  const resolved = await resolveGeneId(geneCandidates, taxId)
  if (!resolved) {
    throw new Error(
      `Could not resolve any of ${geneCandidates.join(', ')} to an NCBI gene in taxon ${taxId}. Try the NCBI BLAST tab, which needs no gene identifier.`,
    )
  }

  // The query row. The dialog always supplies it — it is the user's OWN
  // selected transcript, which is what makes `connectedFeature` map genome
  // coordinates through this row. A launch that has no transcript to translate
  // (a session spec naming only a gene) falls back to NCBI's representative
  // protein for the resolved gene, which is the same choice made for every
  // other row, so the alignment is the one NCBI would build for that gene.
  const representative = await fetchRepresentativeQueryProtein(resolved.geneId)
  const cleanedSeq = proteinSequence
    ? cleanProteinSequence(proteinSequence)
    : representative?.sequence
  if (!cleanedSeq) {
    throw new Error(
      `No query protein: none was supplied and NCBI returned no representative protein for gene ${resolved.geneId}.`,
    )
  }

  // Every species NCBI has an ortholog for, when a launch names none, capped at
  // maxSpecies. A launch that wants specific species lists them; one that just
  // wants "this gene across species" gets NCBI's own order, which leads with the
  // reference organisms.
  const rows = await fetchOrthologRows({
    geneId: resolved.geneId,
    taxa: taxa ? new Set(taxa) : undefined,
    // the query species is represented by the query row above
    exclude: taxId,
    limit: maxSpecies,
    onProgress,
  })

  // The query row is named for its species like every other row, with a suffix
  // marking it as the one the genome view is linked to. A bare `QUERY` among
  // ninety-nine named species reads as a row whose species failed to resolve,
  // and there is nothing else in the picture saying which row the hover
  // highlight travels through -- react-msaview has no notion of a query row, it
  // only looks one up by name.
  //
  // Deduped against the ortholog labels rather than assumed unique: the query
  // taxon is excluded from that set, but a subspecies can sanitize to the same
  // token, and a collision would silently point the coordinate mapping at
  // another animal's row.
  const queryLabel = await queryRowLabel(taxId, rows)
  self.setQuerySeqName(queryLabel)

  const treeMetadata: Record<string, Record<string, string>> = {
    [queryLabel]: buildQueryMetadata(
      self,
      resolved.geneId,
      cleanedSeq,
      representative,
    ),
  }
  for (const row of rows) {
    treeMetadata[row.label] = buildRowMetadata(row)
  }

  const result = await launchMSA({
    algorithm: msaAlgorithm,
    sequence: [
      `>${queryLabel}\n${cleanedSeq}`,
      ...rows.map(r => `>${r.label}\n${r.sequence}`),
    ].join('\n'),
    onProgress,
  })

  return {
    ...result,
    treeMetadata: JSON.stringify(treeMetadata),
  }
}

/**
 * `<species>_query`, unique against the ortholog labels. Falls back to the bare
 * marker when NCBI cannot name the taxon, which is a naming failure and must not
 * take down the launch.
 */
async function queryRowLabel(taxId: number, rows: OrthologRow[]) {
  let name: string | undefined
  try {
    const info = (await fetchTaxonomyInfo([taxId])).get(taxId)
    name = info?.commonName ?? info?.sciname
  } catch (e) {
    console.warn('[msaview-orthologs] taxonomy name lookup failed:', e)
  }
  return dedupeLabels([
    ...rows.map(r => r.label),
    `${name ?? 'query'}_query`,
  ]).at(-1)!
}

/**
 * A failed lookup only costs the query row its domain overlay and, for a launch
 * that supplied no sequence of its own, the alignment — so it is reported by
 * returning nothing rather than by throwing here.
 */
async function fetchRepresentativeQueryProtein(geneId: string) {
  try {
    return await fetchProteinForGene(geneId)
  } catch (e) {
    console.warn('[msaview-orthologs] query protein lookup failed:', e)
    return undefined
  }
}

/**
 * The query row carries an Accession — which is what drives the automatic CDD
 * overlay (afterCreateAutoruns.autoLoadProteinDomains -> loadProteinDomains) —
 * ONLY when its sequence is byte-identical to the RefSeq protein that accession
 * names. Attaching it unconditionally would put every domain box at an offset
 * whenever the user picked a non-representative isoform, which is a silently
 * wrong figure rather than a missing one. A launch that took the representative
 * protein as its query row passes that test by construction.
 */
function buildQueryMetadata(
  self: JBrowsePluginMsaViewModel,
  geneId: string,
  proteinSequence: string,
  representative: { accession: string; sequence: string } | undefined,
): Record<string, string> {
  const transcript = self.orthologParams?.selectedTranscript
  const metadata: Record<string, string> = { 'Gene ID': geneId }
  const name = transcript?.get('name') ?? transcript?.get('id')
  if (name) {
    metadata.Transcript = name
  }
  if (representative?.sequence === proteinSequence) {
    metadata.Accession = representative.accession
  }
  return metadata
}

function buildRowMetadata(row: OrthologRow): Record<string, string> {
  const metadata: Record<string, string> = {
    'Scientific name': row.scientificName,
    // Accession drives the automatic CDD domain overlay
    // (afterCreateAutoruns.autoLoadProteinDomains -> loadProteinDomains)
    Accession: row.protein,
    'Gene ID': row.geneId,
  }
  if (row.commonName) {
    metadata['Common name'] = row.commonName
  }
  return metadata
}
