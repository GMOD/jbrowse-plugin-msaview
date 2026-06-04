import { getCachedDomains, saveDomains } from './domainCache'
import { efetchUrl } from './eutils'
import { textfetch } from './fetch'

import type { InterProScanResults } from 'react-msaview'

export type DomainMatch = InterProScanResults['matches'][number]

function field(xml: string, tag: string) {
  return new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(xml)?.[1]
}

function parseQualifiers(featureXml: string) {
  const quals: Record<string, string> = {}
  const re = /<GBQualifier>([\s\S]*?)<\/GBQualifier>/g
  let m
  while ((m = re.exec(featureXml)) !== null) {
    const name = field(m[1]!, 'GBQualifier_name')
    const value = field(m[1]!, 'GBQualifier_value')
    // keep the first occurrence: NCBI lists the canonical value first
    if (name && value !== undefined && quals[name] === undefined) {
      quals[name] = value
    }
  }
  return quals
}

// A feature can span several intervals: domains are usually one contiguous
// range, but CDD Sites (e.g. an active site) are a set of scattered residues
// expressed as multiple GBInterval ranges and single GBInterval_point residues.
function parseLocations(featureXml: string) {
  const locations: { start: number; end: number }[] = []
  const re = /<GBInterval>([\s\S]*?)<\/GBInterval>/g
  let m
  while ((m = re.exec(featureXml)) !== null) {
    const block = m[1]!
    const from = field(block, 'GBInterval_from')
    const to = field(block, 'GBInterval_to')
    const point = field(block, 'GBInterval_point')
    if (from && to) {
      locations.push({ start: Number(from), end: Number(to) })
    } else if (point) {
      locations.push({ start: Number(point), end: Number(point) })
    }
  }
  return locations
}

function parseFeature(featureXml: string): DomainMatch | undefined {
  const key = field(featureXml, 'GBFeature_key')
  if (key !== 'Region' && key !== 'Site') {
    return undefined
  }
  const quals = parseQualifiers(featureXml)
  const xref = quals.db_xref
  // only CDD-backed features are conserved-domain annotations; Regions/Sites
  // without a CDD xref are UniProt-propagated motifs we don't want here
  if (!xref?.startsWith('CDD:')) {
    return undefined
  }
  const locations = parseLocations(featureXml)
  if (locations.length === 0) {
    return undefined
  }
  const cddId = xref.replace('CDD:', '')
  if (key === 'Region') {
    const name = quals.region_name ?? cddId
    return {
      signature: {
        entry: { name, description: quals.note ?? name, accession: cddId },
      },
      locations,
    }
  }
  // Sites get a distinct accession (their own color/legend/filter in
  // react-msaview), otherwise they would inherit the parent domain's color and
  // be invisible inside its box
  const siteType = quals.site_type ?? 'site'
  return {
    signature: {
      entry: {
        name: siteType,
        description: quals.note ?? siteType,
        accession: `${cddId}:${siteType}`,
      },
    },
    locations,
  }
}

/**
 * Parse a GenPept (efetch db=protein&rettype=gp&retmode=xml) document into CDD
 * domain and site annotations, keyed by both the versioned and primary
 * accession so callers can look up by whichever NCBI returned.
 */
export function parseCddDomains(xml: string) {
  const byAccession = new Map<string, DomainMatch[]>()
  const seqRe = /<GBSeq>([\s\S]*?)<\/GBSeq>/g
  let seqMatch
  while ((seqMatch = seqRe.exec(xml)) !== null) {
    const seqXml = seqMatch[1]!
    const matches: DomainMatch[] = []

    const featRe = /<GBFeature>([\s\S]*?)<\/GBFeature>/g
    let featMatch
    while ((featMatch = featRe.exec(seqXml)) !== null) {
      const match = parseFeature(featMatch[1]!)
      if (match) {
        matches.push(match)
      }
    }

    for (const acc of [
      field(seqXml, 'GBSeq_accession-version'),
      field(seqXml, 'GBSeq_primary-accession'),
    ]) {
      if (acc) {
        byAccession.set(acc, matches)
      }
    }
  }
  return byAccession
}

/**
 * Fetch pre-computed CDD domain and site annotations for NCBI protein
 * accessions. These come baked into the GenPept records, so a single batched
 * efetch returns them with no job submission or polling. Results are cached in
 * IndexedDB so reopening a view doesn't refetch.
 */
export async function fetchProteinDomains(accessions: string[]) {
  const unique = [...new Set(accessions)].filter(Boolean)
  const byAccession = new Map<string, DomainMatch[]>()

  const cached = await getCachedDomains(unique)
  const uncached: string[] = []
  unique.forEach((acc, i) => {
    const hit = cached[i]
    if (hit) {
      byAccession.set(acc, hit.matches)
    } else {
      uncached.push(acc)
    }
  })

  const toCache: { accession: string; matches: DomainMatch[] }[] = []
  const batchSize = 100
  for (let i = 0; i < uncached.length; i += batchSize) {
    const batch = uncached.slice(i, i + batchSize)
    const xml = await textfetch(
      efetchUrl({
        db: 'protein',
        id: batch.join(','),
        rettype: 'gp',
        retmode: 'xml',
      }),
    )
    const parsed = parseCddDomains(xml)
    for (const acc of batch) {
      const matches = parsed.get(acc) ?? []
      byAccession.set(acc, matches)
      toCache.push({ accession: acc, matches })
    }
  }
  if (toCache.length > 0) {
    await saveDomains(toCache)
  }
  return byAccession
}
