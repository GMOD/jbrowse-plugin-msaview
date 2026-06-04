import { fetchProteinDomains } from '../utils/ncbiDomains'

import type { InterProScanResults } from 'react-msaview'

// structural subset of the MSA model: the full model type can't be used here
// because it references this very action, creating a self-referential cycle
interface DomainModel {
  data: { treeMetadata?: string }
  setProgress: (arg: string) => void
  setDomains: (data: Record<string, InterProScanResults>) => void
}

/**
 * Overlay protein domains on the alignment using NCBI's pre-computed CDD
 * annotations. The BLAST workflow stores each hit's accession in treeMetadata,
 * so we look those up via efetch and key the results by MSA row name (which is
 * what react-msaview matches domains against).
 */
export async function loadProteinDomains(self: DomainModel) {
  const metadataJson = self.data.treeMetadata
  if (!metadataJson) {
    throw new Error('No sequence metadata available to look up domains')
  }
  const metadata = JSON.parse(metadataJson) as Record<
    string,
    Record<string, string>
  >

  const rowAccessions = Object.entries(metadata)
    .map(([rowName, meta]) => ({ rowName, accession: meta.Accession }))
    .filter((r): r is { rowName: string; accession: string } => !!r.accession)

  if (rowAccessions.length === 0) {
    throw new Error('No NCBI accessions found in alignment rows')
  }

  self.setProgress(
    `Fetching protein domains from NCBI for ${rowAccessions.length} sequences...`,
  )
  const byAccession = await fetchProteinDomains(
    rowAccessions.map(r => r.accession),
  )

  const annotations: Record<string, InterProScanResults> = {}
  for (const { rowName, accession } of rowAccessions) {
    const matches = byAccession.get(accession)
    if (matches && matches.length > 0) {
      annotations[rowName] = { matches, xref: [{ id: rowName }] }
    }
  }

  if (Object.keys(annotations).length === 0) {
    throw new Error('No CDD domain annotations found for these proteins')
  }

  self.setDomains(annotations)
}
