import { fetchProteinDomains } from '../utils/ncbiDomains'

import type { Annotation } from 'react-msaview'

// structural subset of the MSA model: the full model type can't be used here
// because it references this very action, creating a self-referential cycle
interface DomainModel {
  rowData: Record<string, Record<string, string> | undefined>
  setAnnotations: (annotations: Annotation[]) => void
}

/**
 * Overlay protein domains on the alignment using NCBI's pre-computed CDD
 * annotations. Each launch stores a row's accession in its row data, so those
 * are looked up via efetch and keyed by MSA row name, which is what
 * react-msaview matches annotations against.
 */
export async function loadProteinDomains(
  self: DomainModel,
  signal?: AbortSignal,
) {
  const rowAccessions = Object.entries(self.rowData).flatMap(
    ([rowName, row]) =>
      row?.Accession ? [{ rowName, accession: row.Accession }] : [],
  )
  if (rowAccessions.length === 0) {
    throw new Error('No NCBI accessions found in alignment rows')
  }

  const byAccession = await fetchProteinDomains(
    rowAccessions.map(r => r.accession),
    signal,
  )

  const annotations = rowAccessions.flatMap(({ rowName, accession }) =>
    (byAccession.get(accession) ?? []).flatMap(({ signature, locations }) =>
      signature.entry
        ? locations.map(({ start, end }) => ({
            id: rowName,
            accession: signature.entry!.accession,
            name: signature.entry!.name,
            description: signature.entry!.description,
            start,
            end,
          }))
        : [],
    ),
  )

  if (annotations.length === 0) {
    throw new Error('No CDD domain annotations found for these proteins')
  }

  self.setAnnotations(annotations)
}
