import { cleanProteinSequence } from '../LaunchMsaView/util'
import { launchMSA } from '../utils/msa'
import {
  fetchOrthologRows,
  fetchProteinForGene,
  resolveGeneId,
} from '../utils/ncbiOrthologs'

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
  const { taxId, taxa, geneCandidates, msaAlgorithm, proteinSequence } =
    self.orthologParams!
  const cleanedSeq = cleanProteinSequence(proteinSequence)

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

  // the query species is represented by the user's own transcript below
  const wanted = new Set(taxa.filter(t => t !== taxId))
  const rows = await fetchOrthologRows({
    geneId: resolved.geneId,
    taxa: wanted,
    onProgress,
  })

  const treeMetadata: Record<string, Record<string, string>> = {
    QUERY: await buildQueryMetadata(self, resolved.geneId, cleanedSeq),
  }
  for (const row of rows) {
    treeMetadata[row.label] = buildRowMetadata(row)
  }

  const result = await launchMSA({
    algorithm: msaAlgorithm,
    sequence: [
      `>QUERY\n${cleanedSeq}`,
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
 * The query row is the user's own translated transcript, so it carries an
 * Accession — which is what drives the automatic CDD overlay
 * (afterCreateAutoruns.autoLoadProteinDomains -> loadProteinDomains) — ONLY
 * when its sequence is byte-identical to the RefSeq protein that accession
 * names. Attaching it unconditionally would put every domain box at an offset
 * whenever the user picked a non-representative isoform, which is a silently
 * wrong figure rather than a missing one.
 */
async function buildQueryMetadata(
  self: JBrowsePluginMsaViewModel,
  geneId: string,
  proteinSequence: string,
): Promise<Record<string, string>> {
  const transcript = self.orthologParams?.selectedTranscript
  const metadata: Record<string, string> = { 'Gene ID': geneId }
  const name = transcript?.get('name') ?? transcript?.get('id')
  if (name) {
    metadata.Transcript = name
  }
  try {
    const representative = await fetchProteinForGene(geneId)
    if (representative?.sequence === proteinSequence) {
      metadata.Accession = representative.accession
    }
  } catch (e) {
    // a failed lookup only costs the query row its domain overlay, so it must
    // not take down an alignment that is otherwise complete
    console.warn('[msaview-orthologs] query protein lookup failed:', e)
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
