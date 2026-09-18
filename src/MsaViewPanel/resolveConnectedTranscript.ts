import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { transaction, untracked } from 'mobx'

import { getProteinSequenceFromFeature } from '../LaunchMsaView/components/calculateProteinSequence'
import { fetchSeq } from '../LaunchMsaView/components/fetchSeq'
import { getTranscriptFeatures } from '../LaunchMsaView/util'

import type {
  BlastParams,
  JBrowsePluginMsaViewModel,
  OrthologParams,
} from './model'
import type { Feature } from '@jbrowse/core/util'

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

/**
 * Gene models live on feature tracks. Asking an alignments, variant or
 * quantitative track for a chromosome's worth of features to look for a
 * transcript among them is the slowest possible way to find nothing.
 */
export function transcriptTracks<T extends { type: string }>(tracks: T[]) {
  return tracks.filter(t => t.type === 'FeatureTrack')
}

async function findTranscript(
  self: JBrowsePluginMsaViewModel,
  transcriptId: string,
) {
  const view = self.connectedView!
  const session = getSession(self)
  const sessionId = 'msaview-connectedTranscript'
  const tracks = transcriptTracks(view.tracks)
  for (const regions of searchWindows(view)) {
    for (const track of tracks) {
      // a named object keeps sessionId, which v4 hosts read from the args
      const args = {
        adapterConfig: getConf(track, 'adapter'),
        sessionId,
        regions,
      }
      const feats = await session.rpcManager.call(
        sessionId,
        'CoreGetFeatures',
        args,
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

async function translate(self: JBrowsePluginMsaViewModel, transcript: Feature) {
  const { start, end, refName } = transcript.toJSON() as {
    start: number
    end: number
    refName: string
  }
  const assemblyName = self.connectedView!.assemblyNames[0]!
  const { seq, assemblyGeneticCodeId } = await fetchSeq({
    start,
    end,
    refName,
    assemblyName,
    session: getSession(self),
  })
  return getProteinSequenceFromFeature({
    seq,
    feature: transcript,
    assemblyGeneticCodeId,
  })
}

/** the latest lookup per view; an older one finishing late writes nothing */
const latestLookup = new WeakMap<object, number>()

async function lookUp({
  self,
  transcriptId,
  blastParams,
  orthologParams,
  isCurrent,
}: {
  self: JBrowsePluginMsaViewModel
  transcriptId: string
  blastParams: BlastParams | undefined
  orthologParams: OrthologParams | undefined
  isCurrent: () => boolean
}) {
  const trackCount = transcriptTracks(self.connectedView!.tracks).length
  try {
    self.setProgress(`Looking up ${transcriptId} in the genome view...`)
    const transcript = await findTranscript(self, transcriptId)
    if (!transcript) {
      throw new Error(
        `Transcript "${transcriptId}" was not found in the ${trackCount} feature track(s) open in the connected genome view. Open the gene track that carries it, and make sure the view is on its locus.`,
      )
    }
    const proteinSequence = await translate(self, transcript)
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
    console.error(e)
    if (isCurrent()) {
      self.setProgress('')
      self.setError(e)
    }
  }
}

/**
 * Resolve `connectedTranscript` into `connectedFeature` once the connected
 * genome view has its assembly and tracks, then hand the translation to
 * whichever launch is waiting for a query.
 *
 * The autorun re-fires on the view's readiness (a track opened after a miss)
 * and on the request itself, which is what `retryLaunch` re-states. The lookup
 * runs untracked, so scrolling the genome view is not a reason to look again.
 */
export function resolveConnectedTranscriptIfNeeded(
  self: JBrowsePluginMsaViewModel,
) {
  const {
    connectedTranscript,
    connectedFeature,
    connectedView,
    blastParams,
    orthologParams,
  } = self
  if (
    !connectedTranscript ||
    connectedFeature ||
    !connectedView?.initialized ||
    connectedView.tracks.length === 0
  ) {
    return
  }
  const lookup = (latestLookup.get(self) ?? 0) + 1
  latestLookup.set(self, lookup)
  untracked(() => {
    void lookUp({
      self,
      transcriptId: connectedTranscript,
      blastParams,
      orthologParams,
      isCurrent: () => isAlive(self) && latestLookup.get(self) === lookup,
    })
  })
}
