/**
 * Whether `querySeqName` names a row this alignment actually has. The name
 * defaults to `QUERY`, which an uploaded alignment has no reason to carry, so
 * the genome and structure hovers ask this before mapping anything.
 *
 * `rowMap`, not `rows`: `rows` is what is on screen, and a query row folded
 * into a collapsed clade is still in the alignment, still has its columns, and
 * still maps.
 */
export function hasQueryRow(model: {
  rowMap: ReadonlyMap<string, string>
  querySeqName: string
}) {
  return model.rowMap.has(model.querySeqName)
}

/**
 * The transcript a launch was started from, as it is stored: plain JSON.
 *
 * blastParams and orthologParams are frozen snapshot properties, so a Feature
 * instance put in one lives only as long as the tab. A reloaded session hands
 * back the JSON the instance serialized to, and `.get()` on that threw --
 * minutes after the EBI job the reload resubmitted had finally come back.
 */
export type TranscriptRef = Record<string, unknown> | LiveFeature

interface LiveFeature {
  toJSON: () => Record<string, unknown>
}

/**
 * Read the transcript's fields whichever shape it arrived in: a caller inside
 * the session may still hand over a live Feature.
 */
export function transcriptFields(transcript?: TranscriptRef) {
  if (!transcript) {
    return {}
  }
  return typeof (transcript as LiveFeature).toJSON === 'function'
    ? (transcript as LiveFeature).toJSON()
    : (transcript as Record<string, unknown>)
}

function str(val: unknown) {
  return typeof val === 'string' ? val : undefined
}

/** what a transcript is called, preferring its name over its id */
export function transcriptName(transcript?: TranscriptRef) {
  const fields = transcriptFields(transcript)
  return str(fields.name) ?? str(fields.id)
}

interface QueryRowColumns {
  querySeqName: string
  seqPosToVisibleCol: (rowName: string, seqPos: number) => number | undefined
  visibleColToSeqPos: (
    rowName: string,
    visibleCol: number,
  ) => number | undefined
}

export interface QueryRowModel extends QueryRowColumns {
  querySeqOffset: number
}

/**
 * The visible column showing residue `seqPos` (0-based) of the query row, or
 * undefined when the row does not carry that residue or react-msaview is
 * hiding its column.
 *
 * react-msaview answers one column past the end for a position the row does not
 * have, which would light the last column for every residue beyond the row, so
 * the round trip back through visibleColToSeqPos is what rejects those.
 */
export function querySeqPosToVisibleCol(
  model: QueryRowColumns,
  seqPos: number,
) {
  const { querySeqName } = model
  if (seqPos < 0) {
    return undefined
  }
  const col = model.seqPosToVisibleCol(querySeqName, seqPos)
  return col !== undefined &&
    model.visibleColToSeqPos(querySeqName, col) === seqPos
    ? col
    : undefined
}

/**
 * The visible column showing residue `proteinPos` (0-based) of the transcript.
 * `querySeqOffset` is what separates the two: a pasted BLAST alignment carries
 * the aligned region, not the whole protein.
 */
export function transcriptPosToVisibleCol(
  model: QueryRowModel,
  proteinPos: number,
) {
  return querySeqPosToVisibleCol(model, proteinPos - model.querySeqOffset)
}

export function hasHoverPosition(
  hovered: unknown,
): hovered is { hoverPosition: { coord: number; refName: string } } {
  return (
    !!hovered &&
    typeof hovered === 'object' &&
    'hoverPosition' in hovered &&
    !!hovered.hoverPosition
  )
}

/**
 * Extracts UniProt ID from an AlphaFold URL
 * Examples:
 * - https://alphafold.ebi.ac.uk/files/AF-P12345-F1-model_v6.cif -> P12345
 * - https://alphafold.ebi.ac.uk/files/msa/AF-P12345-F1-msa_v6.a3m -> P12345
 */
export function getUniprotIdFromAlphaFoldUrl(url: string) {
  const match = /AF-([A-Z0-9]+)-F\d+/.exec(url)
  return match?.[1]
}
