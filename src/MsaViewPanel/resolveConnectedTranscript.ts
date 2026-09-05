import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'

import { getProteinSequenceFromFeature } from '../LaunchMsaView/components/calculateProteinSequence'
import { fetchSeq } from '../LaunchMsaView/components/fetchSeq'
import { getTranscriptFeatures } from '../LaunchMsaView/util'

import type { JBrowsePluginMsaViewModel } from './model'
import type { Feature } from '@jbrowse/core/util'

// The short form of a connected launch. A spec that says
//
//   {"type":"MsaView","connectedViewId":"lgv1","connectedTranscript":"NM_000546.6", ...}
//
// gets its `connectedFeature` -- the exon model every genome<->column mapping
// runs through -- looked up here, from the gene tracks the connected genome
// view has open, and its query row translated from that transcript. Before
// this the spec had to carry the transcript's CDS list itself, ~1.5kB of
// coordinates a person cannot type and a tutorial cannot show.
//
// jbrowse-plugin-protein3d does the same for its `transcriptId` shorthand,
// against a `connectedView` spec of its own; here the genome view already
// exists (the spec pinned its id), so its tracks and regions are read off the
// live model instead.

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

async function findTranscript(
  self: JBrowsePluginMsaViewModel,
  transcriptId: string,
) {
  const view = self.connectedView!
  const session = getSession(self)
  const sessionId = 'msaview-connectedTranscript'
  const regions = view.displayedRegions.map(r => ({
    assemblyName: r.assemblyName,
    refName: r.refName,
    start: r.start,
    end: r.end,
  }))
  for (const track of view.tracks) {
    const feats = (await session.rpcManager.call(sessionId, 'CoreGetFeatures', {
      adapterConfig: getConf(track, 'adapter'),
      sessionId,
      regions,
    })) as Feature[]
    for (const feat of feats) {
      const hit = getTranscriptFeatures(feat).find(t =>
        transcriptMatches(t, transcriptId),
      )
      if (hit) {
        return hit
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
  const seq = await fetchSeq({
    start,
    end,
    refName,
    assemblyName,
    session: getSession(self),
  })
  return getProteinSequenceFromFeature({ seq, feature: transcript })
}

/**
 * Resolve `connectedTranscript` into `connectedFeature` once the connected
 * genome view has its assembly, regions and tracks, then hand the translation
 * to whichever launch is waiting for a query. Left in place on failure so the
 * error stays attributable; the autorun's tracked reads are the view's
 * readiness, so nothing refires until that changes.
 */
export function resolveConnectedTranscriptIfNeeded(
  self: JBrowsePluginMsaViewModel,
) {
  const { connectedTranscript, connectedFeature, connectedView } = self
  if (
    !connectedTranscript ||
    connectedFeature ||
    !connectedView?.initialized ||
    connectedView.tracks.length === 0
  ) {
    return
  }
  const trackCount = connectedView.tracks.length
  void (async () => {
    try {
      self.setProgress(
        `Looking up ${connectedTranscript} in the genome view...`,
      )
      const transcript = await findTranscript(self, connectedTranscript)
      if (!transcript) {
        throw new Error(
          `Transcript "${connectedTranscript}" was not found in the ${trackCount} track(s) open in the connected genome view. Open the gene track that carries it, and make sure the view is on its locus.`,
        )
      }
      const proteinSequence = await translate(self, transcript)
      if (!proteinSequence) {
        throw new Error(
          `Transcript "${connectedTranscript}" has no CDS to translate`,
        )
      }
      const { blastParams, orthologParams } = self
      if (blastParams && !blastParams.proteinSequence) {
        self.setBlastParams({
          ...blastParams,
          selectedTranscript: transcript,
          proteinSequence,
        })
      }
      if (orthologParams && !orthologParams.proteinSequence) {
        self.setOrthologParams({
          ...orthologParams,
          selectedTranscript: transcript,
          proteinSequence,
        })
      }
      // last, because the launchers wake on it
      self.setConnectedFeature(transcript.toJSON())
    } catch (e) {
      console.error(e)
      self.setError(e)
    }
  })()
}
