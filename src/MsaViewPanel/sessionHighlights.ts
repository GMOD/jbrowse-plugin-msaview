import { getSession } from '@jbrowse/core/util'

import { hasQueryRow } from './util'

import type { JBrowsePluginMsaViewModel } from './model'
import type { TranscriptMap } from './transcriptMap'

/** The `transientHighlights` owner the session's highlights draw under */
export const SESSION_HIGHLIGHT_OWNER = 'session-highlights'

/** A session highlight: a genome region, 0-based half-open */
export interface GenomeHighlight {
  assemblyName: string
  refName: string
  start: number
  end: number
  label?: string
  color?: string
}

/** react-msaview's residue-span highlight: residues of `row`, 1-based */
export interface RowHighlight {
  row: string
  start: number
  end: number
  label?: string
  color?: string
}

/**
 * Where the query row sits on the genome: through a transcript, each coding
 * base mapping to its residue, or as the bases of a MAF block
 */
export type QueryOnGenome =
  | { kind: 'transcript'; map: Pick<TranscriptMap, 'g2p' | 'refName'> }
  | { kind: 'maf'; refName: string; start: number; end: number }

/**
 * The 0-based query-row positions a genome region covers. A transcript's
 * residues count from its start codon, so `querySeqOffset` moves them onto a
 * query row that holds only part of the protein.
 */
function rowPositions(
  { start, end }: GenomeHighlight,
  onGenome: QueryOnGenome,
  querySeqOffset: number,
) {
  const positions = new Set<number>()
  if (onGenome.kind === 'maf') {
    for (
      let base = Math.max(start, onGenome.start);
      base < Math.min(end, onGenome.end);
      base++
    ) {
      positions.add(base - onGenome.start)
    }
  } else {
    for (let base = start; base < end; base++) {
      const residue = onGenome.map.g2p[base]
      if (residue !== undefined) {
        positions.add(residue - querySeqOffset)
      }
    }
  }
  return [...positions].filter(p => p >= 0).sort((a, b) => a - b)
}

/**
 * The session's highlights on the query row, one residue span per run of
 * consecutive residues a highlight covers, each keeping the highlight's label
 * and color. A highlight on another assembly or chromosome, or off the
 * transcript, draws nothing here.
 */
export function sessionHighlightsOnQueryRow({
  highlights,
  onGenome,
  querySeqName,
  querySeqOffset,
  sameAssembly,
  sameRefName,
  labels,
}: {
  highlights: readonly GenomeHighlight[]
  onGenome: QueryOnGenome
  querySeqName: string
  querySeqOffset: number
  sameAssembly: (assemblyName: string) => boolean
  sameRefName: (refName: string) => boolean
  /** whether the session writes labels on its highlights */
  labels: boolean
}): RowHighlight[] {
  return highlights.flatMap(h => {
    if (!sameAssembly(h.assemblyName) || !sameRefName(h.refName)) {
      return []
    }
    const runs: RowHighlight[] = []
    for (const pos of rowPositions(h, onGenome, querySeqOffset)) {
      const last = runs.at(-1)
      if (last?.end === pos) {
        last.end = pos + 1
      } else {
        runs.push({
          row: querySeqName,
          start: pos + 1,
          end: pos + 1,
          ...(labels && h.label ? { label: h.label } : {}),
          ...(h.color ? { color: h.color } : {}),
        })
      }
    }
    return runs
  })
}

// `highlightLabelsVisible` arrived in core after the oldest host this plugin
// supports, which writes every label
function labelsVisible(session: object) {
  return !(
    'highlightLabelsVisible' in session &&
    session.highlightLabelsVisible === false
  )
}

/**
 * Draw the session's highlights on the query row as react-msaview transient
 * highlights, so a codon highlighted on the genome lights and labels its
 * alignment column. They are derived, so the alignment's own snapshot never
 * holds them.
 */
export function syncSessionHighlights(self: JBrowsePluginMsaViewModel) {
  return () => {
    const session = getSession(self)
    const { connectedView, transcriptToMsaMap, mafRegion } = self
    const assemblyName =
      mafRegion?.assemblyName ?? connectedView?.assemblyNames[0]
    const { assemblyManager } = session
    const assembly = assemblyName
      ? assemblyManager.get(assemblyName)
      : undefined
    const onGenome: QueryOnGenome | undefined = mafRegion
      ? { kind: 'maf', ...mafRegion }
      : transcriptToMsaMap
        ? { kind: 'transcript', map: transcriptToMsaMap }
        : undefined
    if (
      !session.highlightsVisible ||
      !session.highlights.length ||
      !onGenome ||
      !assembly?.initialized ||
      !hasQueryRow(self)
    ) {
      self.clearHighlight(SESSION_HIGHLIGHT_OWNER)
      return
    }
    const ownRefName = assembly.getCanonicalRefName(
      onGenome.kind === 'maf' ? onGenome.refName : onGenome.map.refName,
    )
    self.applyHighlight(
      SESSION_HIGHLIGHT_OWNER,
      sessionHighlightsOnQueryRow({
        highlights: session.highlights,
        onGenome,
        querySeqName: self.querySeqName,
        querySeqOffset: self.querySeqOffset,
        sameAssembly: name => assemblyManager.get(name) === assembly,
        sameRefName: refName =>
          assembly.getCanonicalRefName(refName) === ownRefName,
        labels: labelsVisible(session),
      }),
    )
  }
}
