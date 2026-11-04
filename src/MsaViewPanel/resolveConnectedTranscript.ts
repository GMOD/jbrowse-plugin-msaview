import { getConf } from '@jbrowse/core/configuration'
import { getSession, statusProgressLabel } from '@jbrowse/core/util'
import { translateTranscript } from '@jbrowse/core/util/translateTranscript'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { transaction, untracked } from 'mobx'

import { fetchSeq } from '../LaunchMsaView/components/fetchSeq'
import { getTranscriptFeatures } from '../LaunchMsaView/util'
import { errorMessage } from './util'

import type {
  BlastParams,
  JBrowsePluginMsaViewModel,
  OrthologParams,
} from './model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, RpcStatus } from '@jbrowse/core/util'

// The short form of a connected launch. A spec that says
//
//   {"type":"MsaView","connectedViewId":"lgv1","connectedTranscript":"NM_000546.6", ...}
//
// gets its `connectedFeature` -- the exon model every genome<->column mapping
// runs through -- looked up here, from the gene tracks the connected genome
// view has open, and its query row translated from that transcript.
//
// jbrowse-plugin-protein3d does the same for its `transcriptId` shorthand,
// against a `connectedView` spec of its own; here the genome view already
// exists (the spec pinned its id), so its tracks and regions are read off the
// live model instead.

interface Region {
  assemblyName: string
  refName: string
  start: number
  end: number
}

interface GenomeView {
  tracks: { type: string }[]
  displayedRegions: Region[]
  dynamicBlocks?: { contentBlocks?: Region[] }
}

function stripVersion(id: string) {
  return id.replace(/\.\d+$/, '')
}

function transcriptMatches(transcript: Feature, id: string) {
  const target = stripVersion(id)
  return [
    transcript.get('name'),
    transcript.get('id'),
    transcript.get('transcript_id'),
    transcript.id(),
  ].some(c => typeof c === 'string' && (c === id || stripVersion(c) === target))
}

function plainRegions(regions: Region[]) {
  return regions.map(r => ({
    assemblyName: r.assemblyName,
    refName: r.refName,
    start: Math.floor(r.start),
    end: Math.ceil(r.end),
  }))
}

/**
 * The part of the genome on screen, then everything the view can scroll to.
 * `displayedRegions` is usually whole chromosomes -- navigating to a locus
 * displays its parent region -- so it is the fallback, not the first ask.
 */
export function searchWindows(view: GenomeView) {
  const visible = plainRegions(view.dynamicBlocks?.contentBlocks ?? [])
  const displayed = plainRegions(view.displayedRegions)
  return visible.length > 0 ? [visible, displayed] : [displayed]
}

function isTranscriptTrack(track: { type: string }) {
  return track.type === 'FeatureTrack'
}

/**
 * Gene models live on feature tracks. Asking an alignments, variant or
 * quantitative track for a chromosome's worth of features to look for a
 * transcript among them is the slowest possible way to find nothing.
 */
export function transcriptTracks<
  T extends { type: string; configuration: AnyConfigurationModel },
>(tracks: readonly T[]) {
  return tracks.filter(t => isTranscriptTrack(t))
}

async function findTranscript(
  self: JBrowsePluginMsaViewModel,
  transcriptId: string,
  signal: AbortSignal,
  statusCallback: (status: RpcStatus) => void,
) {
  const view = self.connectedView!
  const session = getSession(self)
  const sessionId = 'msaview-connectedTranscript'
  const tracks = transcriptTracks(view.tracks)
  for (const regions of searchWindows(view)) {
    for (const track of tracks) {
      const feats = await session.rpcManager.call(
        sessionId,
        'CoreGetFeatures',
        {
          adapterConfig: getConf(track, 'adapter'),
          regions,
          signal,
          statusCallback,
        },
      )
      for (const feat of feats) {
        const hit = getTranscriptFeatures(feat).find(t =>
          transcriptMatches(t, transcriptId),
        )
        if (hit) {
          return hit
        }
      }
    }
  }
  return undefined
}

async function translate(
  self: JBrowsePluginMsaViewModel,
  transcript: Feature,
  signal: AbortSignal,
) {
  const sequence = await fetchSeq({
    start: transcript.get('start'),
    end: transcript.get('end'),
    refName: transcript.get('refName'),
    assemblyName: self.connectedView!.assemblyNames[0]!,
    session: getSession(self),
    signal,
  })
  return translateTranscript({ transcript, ...sequence })?.protein
}

/** the latest lookup per view; a newer one aborts it, so it writes nothing */
const latestLookup = new WeakMap<object, AbortController>()

async function lookUp({
  self,
  transcriptId,
  blastParams,
  orthologParams,
  signal,
}: {
  self: JBrowsePluginMsaViewModel
  transcriptId: string
  blastParams: BlastParams | undefined
  orthologParams: OrthologParams | undefined
  signal: AbortSignal
}) {
  const isCurrent = () => isAlive(self) && !signal.aborted
  const searching = `Looking up ${transcriptId} in the genome view...`
  const trackCount = transcriptTracks(self.connectedView!.tracks).length
  try {
    self.setProgress(searching)
    const transcript = await findTranscript(
      self,
      transcriptId,
      signal,
      (status: RpcStatus) => {
        const label = statusProgressLabel(status)
        if (isCurrent()) {
          self.setProgress(label ? `${searching} ${label}` : searching)
        }
      },
    )
    if (!transcript) {
      throw new Error(
        `Transcript "${transcriptId}" was not found in the ${trackCount} feature track(s) open in the connected genome view. Open the gene track that carries it, and make sure the view is on its locus.`,
      )
    }
    const proteinSequence = await translate(self, transcript, signal)
    if (!proteinSequence) {
      throw new Error(`Transcript "${transcriptId}" has no CDS to translate`)
    }
    if (!isCurrent()) {
      return
    }
    // toJSON, not the Feature: the params are frozen snapshot properties, so
    // an instance in one is gone the moment the session reloads
    const transcriptJson = transcript.toJSON()
    // one transaction, so the launchers wake once, on a request that already
    // carries its query
    transaction(() => {
      self.setProgress('')
      if (blastParams && !blastParams.proteinSequence) {
        self.setBlastParams({
          ...blastParams,
          selectedTranscript: transcriptJson,
          proteinSequence,
        })
      }
      if (orthologParams && !orthologParams.proteinSequence) {
        self.setOrthologParams({
          ...orthologParams,
          selectedTranscript: transcriptJson,
          proteinSequence,
        })
      }
      self.setConnectedFeature(transcriptJson)
    })
  } catch (e) {
    if (isCurrent()) {
      console.error(e)
      self.setProgress('')
      self.failConnection(e)
    }
  }
}

interface ConnectableView {
  initialized: boolean
  pendingLaunch?: unknown
  error?: unknown
  tracks: readonly { type: string }[]
}

/**
 * Whether the connected genome view can be searched for `transcriptId` yet. A
 * view still initializing, or still opening the tracks its launch names, is
 * waited for; everything else that stops a lookup is a problem to report,
 * since nothing would otherwise end the wait. `namedViewType` is the type of
 * whatever view `connectedViewId` names, and `connectedView` that view only
 * when it is a genome view.
 */
export function lookupReadiness<V extends ConnectableView>({
  transcriptId,
  connectedViewId,
  namedViewType,
  connectedView,
}: {
  transcriptId: string
  connectedViewId: string | undefined
  namedViewType: string | undefined
  connectedView: V | undefined
}): { problem: string } | { waiting: true } | { view: V } {
  const cannot = `so transcript "${transcriptId}" cannot be looked up`
  return !connectedViewId
    ? {
        problem: `connectedTranscript "${transcriptId}" needs a connectedViewId naming the genome view to look it up in`,
      }
    : namedViewType === undefined
      ? { problem: `No view with id "${connectedViewId}" is open, ${cannot}` }
      : !connectedView
        ? {
            problem: `The view with id "${connectedViewId}" is a ${namedViewType}, not a LinearGenomeView, ${cannot}`,
          }
        : connectedView.error
          ? {
              problem: `The connected genome view failed to load, ${cannot}: ${errorMessage(connectedView.error)}`,
            }
          : !connectedView.initialized || connectedView.pendingLaunch
            ? { waiting: true }
            : !connectedView.tracks.some(t => isTranscriptTrack(t))
              ? {
                  problem: `The connected genome view has no feature tracks open, ${cannot}. Open the gene track that carries it.`,
                }
              : { view: connectedView }
}

/**
 * Resolve `connectedTranscript` into `connectedFeature` once the connected
 * genome view has its assembly and tracks, then hand the translation to
 * whichever launch is waiting for a query.
 *
 * The autorun re-fires on the view's readiness (a track opened after a miss,
 * a view that arrives after this one) and on the request itself, which is what
 * `retryLaunch` re-states. The lookup runs untracked, so scrolling the genome
 * view is not a reason to look again.
 */
export function resolveConnectedTranscriptIfNeeded(
  self: JBrowsePluginMsaViewModel,
) {
  const {
    connectedTranscript,
    connectedFeature,
    connectedViewId,
    viewNamedByConnectedViewId,
    connectedView,
    blastParams,
    orthologParams,
  } = self
  if (connectedTranscript && !connectedFeature) {
    const readiness = lookupReadiness({
      transcriptId: connectedTranscript,
      connectedViewId,
      namedViewType: viewNamedByConnectedViewId?.type,
      connectedView,
    })
    if ('problem' in readiness) {
      latestLookup.get(self)?.abort()
      self.failConnection(new Error(readiness.problem))
    } else {
      self.clearConnectionFailure()
      if ('view' in readiness) {
        latestLookup.get(self)?.abort()
        const controller = new AbortController()
        latestLookup.set(self, controller)
        untracked(() => {
          void lookUp({
            self,
            transcriptId: connectedTranscript,
            blastParams,
            orthologParams,
            signal: controller.signal,
          })
        })
      }
    }
  }
}
