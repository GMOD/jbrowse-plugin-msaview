import { getCachedDomains, saveDomains } from './domainCache'
import { decodeXmlEntities, efetchUrl, eutilsText } from './eutils'
import { isAbortError } from './fetch'

import type { InterProScanResults } from 'react-msaview'

/** a CDD match, under the GenPept feature key it came from */
export type DomainMatch = InterProScanResults['matches'][number] & {
  featureType: 'Region' | 'Site'
}

function field(xml: string, tag: string) {
  const text = new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(xml)?.[1]
  return text === undefined ? undefined : decodeXmlEntities(text)
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

// A domain is usually one GBInterval range, while a CDD Site is a set of
// scattered residues: several ranges plus single GBInterval_point residues.
// Each becomes its own location, 1-based inclusive, so a site draws on the
// residues it names.
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
  const quals = parseQualifiers(featureXml)
  const xref = quals.db_xref
  const locations = parseLocations(featureXml)
  // only CDD-backed Regions/Sites are conserved-domain annotations; Regions and
  // Sites without a CDD xref are UniProt-propagated point motifs we don't want.
  // A CDD site's single residues (a heme-binding histidine) are real, so no
  // length rule drops them.
  if (
    (key === 'Region' || key === 'Site') &&
    xref?.startsWith('CDD:') &&
    locations.length > 0
  ) {
    const cddId = xref.replace('CDD:', '')
    const isDomain = key === 'Region'
    // a site's note (e.g. "ATP binding site [chemical binding]") is more
    // specific than its generic site_type ("other"), so prefer it for the name
    // — that gives each functional site its own color/legend/filter entry
    const noteName = quals.note?.split(/[[(]/)[0]?.trim()
    const name = isDomain
      ? (quals.region_name ?? cddId)
      : noteName || quals.site_type || 'site'
    const accession = isDomain ? cddId : `${cddId}:${name}`
    return {
      signature: {
        entry: { name, description: quals.note ?? name, accession },
      },
      locations,
      featureType: key,
    }
  }
  return undefined
}

/**
 * Parse a GenPept (efetch db=protein&rettype=gp&retmode=xml) document into CDD
 * domain and site annotations, keyed by both the versioned and primary
 * accession so callers can look up by whichever NCBI returned.
 */
export function parseCddDomains(xml: string): Map<string, DomainMatch[]> {
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
export async function fetchProteinDomains(
  accessions: string[],
  signal?: AbortSignal,
): Promise<Map<string, DomainMatch[]>> {
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
    let xml: string
    try {
      xml = await eutilsText(
        efetchUrl({
          db: 'protein',
          id: batch.join(','),
          rettype: 'gp',
          retmode: 'xml',
        }),
        { signal },
      )
    } catch (e) {
      if (isAbortError(e)) {
        throw e
      }
      // the batches already answered are worth keeping and caching
      console.warn('[msaview-domains] efetch failed, keeping what loaded:', e)
      break
    }
    const parsed = parseCddDomains(xml)
    for (const acc of batch) {
      // only cache accessions actually present in the response: a genuinely
      // domain-less protein comes back as an empty array (cache it), but an
      // accession the batch omitted comes back undefined — caching [] for it
      // would permanently hide its domains on later loads (the domain cache
      // never expires), so leave it uncached to be retried
      const matches = parsed.get(acc)
      if (matches !== undefined) {
        byAccession.set(acc, matches)
        toCache.push({ accession: acc, matches })
      }
    }
  }
  if (toCache.length > 0) {
    await saveDomains(toCache)
  }
  return byAccession
}
