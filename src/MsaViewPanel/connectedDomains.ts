/**
 * The query row's domains on the genome, as data plus one color object. A
 * cross-plugin contract: jbrowse-plugin-protein3d reads it off the view.
 *
 * In grammar-of-graphics terms, `features` is the data and `kind` the field a
 * consumer filters its layers on (protein3d draws `domain` as cartoon and
 * `site` as side chains). `color` is the color channel: a categorical scale
 * over `accession`, whose `domain` lists the accessions, `range` the fills
 * the alignment draws them in, and `labels` what a guide (a legend) names
 * them. Every surface reads that one object: the genome track's display, the
 * structure's layers, its overview rows and each legend.
 */
import { seqPosToGenomeRegions } from './msaCoordToGenomeCoord'

import type { GenomeRegion, SeqPosModel } from './msaCoordToGenomeCoord'
import type { Annotation } from 'react-msaview'

export type DomainKind = 'domain' | 'site'

/** One accession the alignment draws on the query row. */
export interface ConnectedDomain {
  /** the label the alignment's legend shows for the accession */
  name: string
  accession: string
  /**
   * `site` for a set of functional residues (a CDD Site, a GFF `*_site`),
   * `domain` for anything else
   */
  kind: DomainKind
  /**
   * 0-based half-open, ascending, contiguous bases merged: one region per exon
   * piece of a domain, or per run of a site's scattered residues, in the
   * transcript's refName spelling
   */
  regions: GenomeRegion[]
}

/** A categorical color object, spelt as a JBrowse display's `color` config. */
export interface DomainColor {
  field: 'accession'
  domain: string[]
  range: string[]
  labels: string[]
}

export interface ConnectedDomains {
  /** largest first by residues covered */
  features: ConnectedDomain[]
  color: DomainColor
}

/**
 * `site` for CDD's GenPept `Site` key, a Sequence Ontology `*_site` type,
 * InterPro's `Binding_site`, `Active_site` and `Conserved_site`, and UniProt's
 * spelled-out `Binding site`
 */
export function annotationKind(featureType: string | undefined): DomainKind {
  return featureType && /(^|[_ ])site$/i.test(featureType) ? 'site' : 'domain'
}

export interface DomainSource extends SeqPosModel {
  showDomains: boolean
  querySeqName: string
  annotationsByRow: Record<string, Annotation[]>
  annotationTypes: Map<string, Annotation>
  featureColors: Map<Annotation, { fill: string }>
}

function mergeAdjacent(regions: GenomeRegion[]) {
  const merged: GenomeRegion[] = []
  for (const region of regions.toSorted((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && last.refName === region.refName && region.start <= last.end) {
      last.end = Math.max(last.end, region.end)
    } else {
      merged.push({ ...region })
    }
  }
  return merged
}

/**
 * The genome regions under the query row's residues `positions`, 0-based
 * ungapped.
 */
export function residuesToGenomeRegions(
  model: SeqPosModel,
  positions: Iterable<number>,
) {
  const pieces: GenomeRegion[] = []
  for (const pos of positions) {
    pieces.push(...seqPosToGenomeRegions(model, pos))
  }
  return mergeAdjacent(pieces)
}

/**
 * The query row's domains as the alignment shows them, one per accession, so
 * a CDD site's scattered residues are one feature. Empty while the domain
 * overlay is off.
 */
export function connectedDomains(model: DomainSource): ConnectedDomains {
  const byAccession = new Map<string, Annotation[]>()
  if (model.showDomains) {
    for (const annotation of model.annotationsByRow[model.querySeqName] ?? []) {
      const list = byAccession.get(annotation.accession)
      if (list) {
        list.push(annotation)
      } else {
        byAccession.set(annotation.accession, [annotation])
      }
    }
  }
  const placed = [...byAccession]
    .flatMap(([accession, annotations]) => {
      // annotations count residues 1-based inclusive
      const positions = new Set<number>()
      for (const { start, end } of annotations) {
        for (let pos = start - 1; pos < end; pos++) {
          positions.add(pos)
        }
      }
      const first = annotations[0]!
      const fill = model.featureColors.get(first)?.fill
      const regions = residuesToGenomeRegions(model, positions)
      return fill && regions.length > 0
        ? [
            {
              feature: {
                name: model.annotationTypes.get(accession)?.name ?? first.name,
                accession,
                kind: annotationKind(first.featureType),
                regions,
              },
              fill,
              residues: positions.size,
            },
          ]
        : []
    })
    .toSorted((a, b) => b.residues - a.residues)
  return {
    features: placed.map(p => p.feature),
    color: {
      field: 'accession',
      domain: placed.map(p => p.feature.accession),
      range: placed.map(p => p.fill),
      labels: placed.map(p => p.feature.name),
    },
  }
}
