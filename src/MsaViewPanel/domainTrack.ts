import type { ConnectedDomain } from './connectedDomains'

export function domainTrackId(viewId: string) {
  return `msaview-domains-${viewId}`
}

/**
 * A session FeatureTrack drawing `domains` on the genome: one feature per
 * domain, one subfeature per region, so a domain spanning exons draws as boxes
 * joined across the intron. Each feature paints the `color` it carries, and
 * the key names each color with its domain.
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
  domains: ConnectedDomain[]
}) {
  const trackId = domainTrackId(viewId)
  const labelOf = new Map<string, string>()
  for (const { color, name } of domains) {
    if (!labelOf.has(color)) {
      labelOf.set(color, name)
    }
  }
  const colors = [...labelOf.keys()]
  const stranded = strand === undefined ? {} : { strand }
  return {
    type: 'FeatureTrack',
    trackId,
    name,
    assemblyNames: [assemblyName],
    adapter: {
      type: 'FromConfigAdapter',
      features: domains.map(({ name, accession, color, regions }, i) => {
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
          color,
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
        color: {
          field: 'color',
          domain: colors,
          range: colors,
          labels: colors.map(c => labelOf.get(c)!),
          title: 'Domains',
        },
      },
    ],
  }
}
