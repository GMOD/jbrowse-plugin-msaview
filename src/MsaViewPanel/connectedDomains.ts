import { seqPosToGenomeRegions } from './msaCoordToGenomeCoord'

import type { GenomeRegion, SeqPosModel } from './msaCoordToGenomeCoord'
import type { Annotation } from 'react-msaview'

/**
 * One domain the alignment draws on the query row, on the genome. A
 * cross-plugin contract: jbrowse-plugin-protein3d reads it off the view.
 */
export interface ConnectedDomain {
  /** the label the alignment's legend shows for the domain's accession */
  name: string
  accession: string
  /** the fill the alignment draws the domain in */
  color: string
  /**
   * 0-based half-open, ascending, contiguous bases merged: one region per exon
   * piece, in the transcript's refName spelling
   */
  regions: GenomeRegion[]
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
 * The genome regions under residues `start`..`end` of the query row, 1-based
 * inclusive as react-msaview's annotations count them.
 */
export function residuesToGenomeRegions(
  model: SeqPosModel,
  { start, end }: { start: number; end: number },
) {
  const pieces: GenomeRegion[] = []
  for (let pos = start - 1; pos < end; pos++) {
    pieces.push(...seqPosToGenomeRegions(model, pos))
  }
  return mergeAdjacent(pieces)
}

/**
 * The query row's domains as the alignment shows them, longest first as
 * react-msaview draws them, so a nested site painted later lands on top.
 * Empty while the domain overlay is off.
 */
export function connectedDomains(model: DomainSource): ConnectedDomain[] {
  if (!model.showDomains) {
    return []
  }
  return (model.annotationsByRow[model.querySeqName] ?? [])
    .toSorted((a, b) => b.end - b.start - (a.end - a.start))
    .flatMap(annotation => {
      const color = model.featureColors.get(annotation)?.fill
      const regions = residuesToGenomeRegions(model, annotation)
      return color && regions.length > 0
        ? [
            {
              name:
                model.annotationTypes.get(annotation.accession)?.name ??
                annotation.name,
              accession: annotation.accession,
              color,
              regions,
            },
          ]
        : []
    })
}
