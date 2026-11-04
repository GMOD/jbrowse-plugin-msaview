import { fetchProteinDomains } from '../utils/ncbiDomains'
import { errorMessage } from './util'

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
 *
 * Throws when NCBI answered for none of the rows. When it answered for some,
 * their domains are drawn and the returned notice names what is missing. A
 * set of proteins with no CDD annotation leaves the overlay as it was.
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

  const asked = new Set(rowAccessions.map(r => r.accession))
  const { byAccession, failure } = await fetchProteinDomains([...asked], signal)
  const answered = [...asked].filter(a => byAccession.has(a)).length
  if (failure !== undefined && answered === 0) {
    throw new Error(errorMessage(failure), { cause: failure })
  }

  const annotations = rowAccessions.flatMap(({ rowName, accession }) =>
    (byAccession.get(accession) ?? []).flatMap(
      ({ signature, locations, featureType }) =>
        signature.entry
          ? locations.map(({ start, end }) => ({
              id: rowName,
              accession: signature.entry!.accession,
              name: signature.entry!.name,
              description: signature.entry!.description,
              featureType,
              start,
              end,
            }))
          : [],
    ),
  )
  if (annotations.length > 0) {
    self.setAnnotations(annotations)
  }
  return failure === undefined
    ? undefined
    : `Protein domains loaded for ${answered} of ${asked.size} proteins; NCBI failed on the rest: ${errorMessage(failure)}`
}
