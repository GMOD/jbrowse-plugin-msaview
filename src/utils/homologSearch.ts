import { searchEbiBlast } from './ebiBlast'
import { searchEbiPhmmer } from './phmmer'

import type { SearchProgram } from '../LaunchMsaView/components/BlastQuery/consts'
import type { BlastHitDescription } from './types'

// The seam a similarity search sits behind. Every search program answers the
// same question -- what in a database looks like this sequence -- and differs
// only in whether the answer comes back aligned. A backend takes one request
// and returns hits; the launch (doLaunchBlast) names them, fetches taxonomy,
// and either keeps the alignment it was handed or runs an aligner. Adding a
// program means one function here, not a new arm through every layer: a
// self-hosted DIAMOND or MMseqs2 endpoint would be a `SearchBackend` that
// returns unaligned hits and nothing else in the plugin would know.

export interface SearchHit extends BlastHitDescription {
  /**
   * the hit's residues: aligned to the query (with gaps) when the result
   * carries `queryRow`, bare otherwise
   */
  sequence: string
  /** the matched region of the target, for a target that matched more than once */
  range?: string
}

export interface SearchResult {
  /** the job id at the service, for the link the panel shows while it runs */
  rid?: string
  hits: SearchHit[]
  /**
   * the query as the search aligned it, gaps included, when the program aligns
   * as it searches. Absent, the hits are unaligned and an aligner runs next.
   */
  queryRow?: string
}

export interface SearchRequest {
  query: string
  database: string
  maxHits?: number
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
  signal?: AbortSignal
}

export type SearchBackend = (request: SearchRequest) => Promise<SearchResult>

export const searchBackends: Record<SearchProgram, SearchBackend> = {
  blastp: searchEbiBlast,
  phmmer: searchEbiPhmmer,
}
