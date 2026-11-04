import { errorMessage, hasQueryRow, isRecord, transcriptName } from './util'

import type { BlastParams, OrthologParams } from './model'
import type { MafRegion, MsaViewInitState } from './types'

interface ReportedView {
  blastParams: BlastParams | undefined
  orthologParams: OrthologParams | undefined
  init: MsaViewInitState | undefined
  msaFilehandle: object | undefined
  data: { msa?: string; tree?: string }
  dataInitialized: boolean
  launchCompleted: boolean
  rid: string | undefined
  rowMap: ReadonlyMap<string, string>
  MSA: { getWidth: () => number } | null
  annotations: readonly unknown[]
  querySeqName: string
  querySeqOffset: number
  uniprotId: string | undefined
  connectedViewId: string | undefined
  connectedTranscript: string | undefined
  connectedFeature: unknown
  connectedView: object | undefined
  mafRegion: MafRegion | undefined
  transcriptMapping:
    | { reason: string }
    | { map: { refName: string } }
    | undefined
  connectionError: unknown
  showLoading: boolean
  error: unknown
  notices: string[]
}

function locationName(location: object) {
  return 'uri' in location && typeof location.uri === 'string'
    ? location.uri
    : 'localPath' in location && typeof location.localPath === 'string'
      ? location.localPath
      : 'name' in location && typeof location.name === 'string'
        ? location.name
        : undefined
}

function searchSource(view: ReportedView, params: BlastParams) {
  return {
    kind: params.searchProgram === 'phmmer' ? 'phmmer' : 'blastp',
    database: params.blastDatabase,
    msaAlgorithm: params.msaAlgorithm,
    maxHits: params.maxHits,
    accession: params.accession,
    queryLength: params.proteinSequence?.length,
    jobId: view.rid,
    completed: view.launchCompleted,
  }
}

function orthologSource(view: ReportedView, params: OrthologParams) {
  return {
    kind: 'orthologs',
    orthologSource: params.source ?? 'ncbi',
    taxId: params.taxId,
    identity: params.identity,
    maxSpecies: params.maxSpecies,
    taxa: params.taxa,
    geneCandidates: params.geneCandidates,
    msaAlgorithm: params.msaAlgorithm,
    queryLength: params.proteinSequence?.length,
    jobId: view.rid,
    completed: view.launchCompleted,
  }
}

function reportSource(view: ReportedView) {
  const { blastParams, orthologParams, init, msaFilehandle, data } = view
  return blastParams
    ? searchSource(view, blastParams)
    : orthologParams
      ? orthologSource(view, orthologParams)
      : init?.msaUrl
        ? { kind: 'url', url: init.msaUrl }
        : init?.msaIndexedLocation
          ? {
              kind: 'indexed',
              uri: init.msaIndexedLocation.uri,
              name: init.msaName,
            }
          : msaFilehandle
            ? { kind: 'file', location: locationName(msaFilehandle) }
            : data.msa || data.tree
              ? { kind: 'inline' }
              : { kind: 'none' }
}

/**
 * Why the alignment's columns do not reach the genome, the first reason that
 * holds, or undefined when they do.
 */
function unmappedBecause(view: ReportedView) {
  const {
    connectionError,
    connectedTranscript,
    connectedFeature,
    connectedViewId,
    connectedView,
    transcriptMapping,
    mafRegion,
    dataInitialized,
    querySeqName,
  } = view
  return connectionError !== undefined
    ? errorMessage(connectionError)
    : connectedTranscript && !connectedFeature
      ? `transcript "${connectedTranscript}" is still being looked up`
      : !connectedView
        ? connectedViewId
          ? `no genome view with id "${connectedViewId}" is open`
          : 'no connectedViewId names a genome view'
        : transcriptMapping && 'reason' in transcriptMapping
          ? `the transcript is not mapped to the genome: ${transcriptMapping.reason}`
          : !connectedFeature && !mafRegion
            ? 'no connectedFeature or connectedTranscript names a transcript'
            : !dataInitialized
              ? 'no alignment is loaded'
              : !hasQueryRow(view)
                ? `no row is named "${querySeqName}"`
                : undefined
}

function reportConnection(view: ReportedView) {
  const {
    connectedViewId,
    connectedTranscript,
    connectedFeature,
    connectedView,
    transcriptMapping,
    mafRegion,
  } = view
  const reason = unmappedBecause(view)
  return {
    viewId: connectedViewId,
    viewOpen: !!connectedView,
    transcript:
      connectedTranscript ??
      (isRecord(connectedFeature)
        ? transcriptName(connectedFeature)
        : undefined),
    refName:
      transcriptMapping && 'map' in transcriptMapping
        ? transcriptMapping.map.refName
        : mafRegion?.refName,
    mapped: reason === undefined,
    unmappedBecause: reason,
  }
}

/**
 * What a view resolved to, as plain JSON: the header's facts, for a script or
 * an agent to read instead of the model's internals. docs/reading-the-view.md
 * describes each field.
 */
export function viewReport(view: ReportedView) {
  const { connectedViewId, connectedTranscript, connectedFeature, mafRegion } =
    view
  return {
    loading: view.showLoading,
    error: view.error === undefined ? undefined : errorMessage(view.error),
    notices: view.notices,
    source: reportSource(view),
    rows: view.rowMap.size,
    columns: view.MSA?.getWidth() ?? 0,
    domainAnnotations: view.annotations.length,
    uniprotId: view.uniprotId,
    queryRow: {
      name: view.querySeqName,
      found: hasQueryRow(view),
      offset: view.querySeqOffset,
    },
    connection:
      connectedViewId || connectedTranscript || connectedFeature || mafRegion
        ? reportConnection(view)
        : undefined,
  }
}
