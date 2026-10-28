import type { ConnectedDomains } from './connectedDomains'

export function domainTrackId(viewId: string) {
  return `msaview-domains-${viewId}`
}

/**
 * A session FeatureTrack drawing `domains` on the genome: one feature per
 * domain, one subfeature per region, so a domain spanning exons draws as boxes
 * joined across the intron. The display's `encoding.color` is the domains'
 * color channel, a categorical scale over each feature's `accession`, so its
 * key names each color with its domain.
 */
export function domainTrackConf({
  viewId,
  assemblyName,
  name,
  strand,
  domains,
}: {
  viewId: string
  assemblyName: string
  name: string
  strand?: number
  domains: ConnectedDomains
}) {
  const trackId = domainTrackId(viewId)
  const stranded = strand === undefined ? {} : { strand }
  return {
    type: 'FeatureTrack',
    trackId,
    name,
    assemblyNames: [assemblyName],
    adapter: {
      type: 'FromConfigAdapter',
      features: domains.features.map(({ name, accession, regions }, i) => {
        const uniqueId = `${trackId}-${i}`
        return {
          uniqueId,
          refName: regions[0]!.refName,
          start: Math.min(...regions.map(r => r.start)),
          end: Math.max(...regions.map(r => r.end)),
          ...stranded,
          type: 'protein_domain',
          name,
          accession,
          subfeatures: regions.map((r, j) => ({
            uniqueId: `${uniqueId}-${j}`,
            refName: r.refName,
            start: r.start,
            end: r.end,
            ...stranded,
            type: 'protein_domain_part',
          })),
        }
      }),
    },
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: `${trackId}-LinearBasicDisplay`,
        encoding: {
          color: { ...domains.color, legend: { title: 'Domains' } },
        },
      },
    ],
  }
}
