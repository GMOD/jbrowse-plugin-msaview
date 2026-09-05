import { makeId } from '../LaunchMsaView/components/util'

import type { SearchHit } from './homologSearch'
import type { TaxonomyInfo } from './taxonomyNames'
import type { BlastHitDescription } from './types'

/**
 * Turning search results into the rows the view is given, kept free of any
 * jbrowse or network import so the whole assembly can be run and checked
 * outside a browser — see test/phmmerLive.test.ts.
 */
export function buildRowMetadata(
  desc: BlastHitDescription,
  taxonomyInfo: Map<number, TaxonomyInfo>,
) {
  const metadata: Record<string, string> = {}
  const taxInfo = desc.taxid ? taxonomyInfo.get(desc.taxid) : undefined

  if (taxInfo?.sciname) {
    metadata['Scientific name'] = taxInfo.sciname
  }
  if (taxInfo?.commonName) {
    metadata['Common name'] = taxInfo.commonName
  }
  if (desc.accession) {
    metadata.Accession = desc.accession
  }
  if (desc.id) {
    metadata.ID = desc.id
  }
  if (desc.title) {
    metadata.Description = desc.title
  }

  return metadata
}

/**
 * One target can match the query in several places and phmmer emits a row per
 * matched envelope — four for lamprey albumin against human albumin, which has
 * three domains. Those rows share an accession and so would share a name, and
 * duplicate names silently collapse rows in both the MSA and the tree, so the
 * envelope disambiguates them.
 */
export function makeRowNames(
  hits: SearchHit[],
  taxonomyInfo: Map<number, TaxonomyInfo>,
) {
  const baseNames = hits.map(hit => makeId(hit, taxonomyInfo))
  const counts = new Map<string, number>()
  for (const name of baseNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const used = new Set<string>()
  return baseNames.map((base, i) => {
    let name =
      counts.get(base)! > 1 ? `${base}_${hits[i]!.range ?? i + 1}` : base
    while (used.has(name)) {
      name = `${name}_${i + 1}`
    }
    used.add(name)
    return name
  })
}

/**
 * A search result as the view receives it: FASTA whose first row is the query,
 * plus the per-row metadata keyed by the same names, which are also what the
 * tree's leaves are labelled with. With `queryRow` the hits are already in
 * columns and this IS the alignment; without it the rows are bare and the
 * FASTA is what an aligner is handed.
 */
export function buildSearchMsa({
  hits,
  query,
  queryRow,
  taxonomyInfo,
  querySeqName = 'QUERY',
}: {
  hits: SearchHit[]
  query: string
  queryRow?: string
  taxonomyInfo: Map<number, TaxonomyInfo>
  querySeqName?: string
}) {
  const treeMetadata: Record<string, Record<string, string>> = {}
  const rowNames = makeRowNames(hits, taxonomyInfo)
  const sequences = hits.map((hit, i) => {
    const rowName = rowNames[i]!
    treeMetadata[rowName] = buildRowMetadata(hit, taxonomyInfo)
    return `>${rowName}\n${hit.sequence}`
  })

  return {
    msa: [`>${querySeqName}\n${queryRow ?? query}`, ...sequences].join('\n'),
    treeMetadata,
  }
}
