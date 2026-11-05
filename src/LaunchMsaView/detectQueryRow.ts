import { getUngappedSequence, parseMSA } from 'msa-parsers'

import { cleanProteinSequence } from './util'

/**
 * Which row of a pasted alignment is the gene the user launched from.
 *
 * The MsaView needs that row name to tie alignment columns back to genome
 * coordinates, and until now the user typed it. Nothing validates a typo: the
 * view opens, renders, and simply never navigates or highlights, which reads as
 * a broken feature rather than a wrong field. Meanwhile the plugin already
 * knows the protein sequence it sent to BLAST, so it can find the row by
 * sequence instead of asking.
 *
 * NCBI and EBI both rename the query on the way through -- COBALT emits
 * `Query_1`, EBI's aligners carry the accession -- so the name is no help. The
 * residues are, and they survive every rename.
 */

export type MatchQuality = 'exact' | 'partial' | 'similar'

export interface QueryRowMatch {
  name: string
  quality: MatchQuality
  /** identity over the compared region, 0-1 */
  identity: number
  /**
   * Transcript residues before the row's first residue, so transcript position
   * = row position + offset. BLAST reports the aligned region, so a row is
   * often the query with its termini trimmed, and mapping its first residue to
   * the transcript's first residue would put every navigation off by the
   * trimmed amount. Negative when the row is the longer of the two.
   *
   * Zero for a `similar` match, which is the one arm this cannot measure: the
   * row is not the query, so where it starts is a guess.
   */
  offset: number
}

/**
 * The translation as a search launch would have sent it, so a row that launch
 * built matches exactly; case means nothing on either side.
 */
function normalize(seq: string) {
  return cleanProteinSequence(seq).toUpperCase()
}

function identityOverOverlap(a: string, b: string) {
  const len = Math.min(a.length, b.length)
  if (len === 0) {
    return 0
  }
  let same = 0
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) {
      same++
    }
  }
  return same / len
}

/**
 * Below this, a "best" row is not a match at all -- an alignment of homologs is
 * full of rows in the 40-70% range, and picking the top one would silently wire
 * the view to a paralog from another species.
 */
const SIMILARITY_FLOOR = 0.9

/**
 * How much of the query a contained row has to cover. A short fragment is a
 * substring of almost any protein, so without a floor the first few residues of
 * a half-pasted alignment match the query and the field fills in with a row the
 * user is still typing.
 */
const PARTIAL_COVERAGE_FLOOR = 0.5

export interface MsaQueryRow {
  /** every row name, in file order, for the picker to offer */
  names: string[]
  /** the row whose residues are the query's, if one of them is */
  match?: QueryRowMatch
}

/**
 * The picker's whole answer for a pasted alignment: its row names, and which of
 * them is the query.
 *
 * One function rather than two because there is one parse. Both answers were
 * wanted on every keystroke in the paste box, and asking separately parsed a
 * few-hundred-row alignment twice per character.
 */
export function findQueryRow(
  msaText: string,
  proteinSequence: string,
  preferredName?: string,
): MsaQueryRow {
  if (!msaText.trim()) {
    return { names: [] }
  }

  let parsed
  try {
    parsed = parseMSA(msaText)
  } catch {
    // a half-pasted alignment throws here on every keystroke; the caller shows
    // the field rather than an error
    return { names: [] }
  }

  const names = parsed.getNames()
  const query = normalize(proteinSequence)
  return {
    names,
    match: query ? bestMatch(parsed, names, query, preferredName) : undefined,
  }
}

function scoreRow(
  parsed: { getRow: (name: string) => string },
  name: string,
  query: string,
): QueryRowMatch | undefined {
  const row = normalize(getUngappedSequence(parsed.getRow(name)))
  if (!row) {
    return undefined
  } else if (row === query) {
    return { name, quality: 'exact', identity: 1, offset: 0 }
  } else {
    // BLAST reports the aligned region, so the row is often the query trimmed
    // at one or both ends rather than the whole protein
    const contained = query.indexOf(row)
    const containing = row.indexOf(query)
    if (contained !== -1 || containing !== -1) {
      const coverage =
        Math.min(row.length, query.length) / Math.max(row.length, query.length)
      return coverage >= PARTIAL_COVERAGE_FLOOR
        ? {
            name,
            quality: 'partial',
            identity: coverage,
            offset: contained === -1 ? -containing : contained,
          }
        : undefined
    } else {
      const identity = identityOverOverlap(row, query)
      return identity >= SIMILARITY_FLOOR
        ? { name, quality: 'similar', identity, offset: 0 }
        : undefined
    }
  }
}

const qualityOrder: MatchQuality[] = ['exact', 'partial', 'similar']

/**
 * The row matching the protein best. A paralog with an identical protein
 * matches exactly as well as the query does, so a row the dataset itself names
 * as the protein's own wins any tie.
 */
function bestMatch(
  parsed: { getRow: (name: string) => string },
  names: string[],
  query: string,
  preferredName?: string,
) {
  return names
    .map(name => scoreRow(parsed, name, query))
    .filter(match => match !== undefined)
    .sort(
      (a, b) =>
        qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality) ||
        b.identity - a.identity ||
        Number(b.name === preferredName) - Number(a.name === preferredName),
    )[0]
}
