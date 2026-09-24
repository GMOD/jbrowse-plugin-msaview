import { getSession } from '@jbrowse/core/util'
import { transaction } from 'mobx'

import { doLaunchBlast } from './doLaunchBlast'
import { doLaunchOrthologs } from './doLaunchOrthologs'
import { fetchIndexedMsa } from './fetchIndexedMsa'
import { genomeToMSA } from './genomeToMSA'
import { loadProteinDomains } from './loadProteinDomains'
import {
  cleanupOldData,
  generateDataStoreId,
  retrieveMsaData,
  storeMsaData,
} from './msaDataStore'
import { runLaunch } from './runLaunch'
import { getProteinViews } from './structureConnection'
import { proteinPositionsInRange } from './transcriptMap'
import {
  getUniprotIdFromAlphaFoldUrl,
  hasQueryRow,
  transcriptPosToVisibleCol,
} from './util'

import type { JBrowsePluginMsaViewModel } from './model'
import type { MsaDataPayload } from './msaDataStore'

const EXPIRED_MESSAGE =
  "This view's alignment is no longer in browser storage. Stored alignments are kept for 7 days after they were last used, and are lost when site data is cleared."

const RELAUNCHABLE = ' Retry runs the original search again and rebuilds it.'

const START_OVER = ' Relaunch it from the gene to rebuild it.'

const EXPIRED_EXTRAS_WARNING =
  'Part of this view is no longer in browser storage: annotations, a tree or row metadata too large for the session. Stored documents are kept for 7 days after they were last used, and are lost when site data is cleared.'

export function loadStoredData(self: JBrowsePluginMsaViewModel) {
  const { dataStoreId } = self
  if (!dataStoreId) {
    return
  }
  void (async () => {
    try {
      self.setLoadingStoredData(true)
      const stored = await retrieveMsaData(dataStoreId)
      if (self.dataStoreId !== dataStoreId) {
        return
      }
      transaction(() => {
        if (stored) {
          const { data } = self
          if (stored.msa && !data.msa) {
            self.setMSA(stored.msa)
          }
          if (stored.tree && !data.tree) {
            self.setTree(stored.tree)
          }
          if (stored.treeMetadata && !data.treeMetadata) {
            self.setTreeMetadata(stored.treeMetadata)
          }
          if (stored.gff && !data.gff) {
            self.setGFF(stored.gff)
          }
          self.setLastStoredData(stored)
        } else {
          self.setDataStoreId(undefined)
          if (hasAlignmentSource(self)) {
            self.addWarning(EXPIRED_EXTRAS_WARNING)
          } else {
            self.setError(
              new Error(
                EXPIRED_MESSAGE +
                  ((self.blastParams ?? self.orthologParams)
                    ? RELAUNCHABLE
                    : START_OVER),
              ),
            )
          }
        }
      })
    } catch (e) {
      console.error('Failed to load MSA data from IndexedDB:', e)
    } finally {
      self.setLoadingStoredData(false)
    }
  })()
}

function hasAlignmentSource(self: JBrowsePluginMsaViewModel) {
  return !!(
    self.data.msa ||
    self.msaFilehandle ||
    self.init?.msaIndexedLocation
  )
}

function isEmpty(data: MsaDataPayload) {
  return !(data.msa || data.tree || data.treeMetadata || data.gff)
}

function sameData(a: MsaDataPayload | undefined, b: MsaDataPayload) {
  return (
    !!a &&
    a.msa === b.msa &&
    a.tree === b.tree &&
    a.treeMetadata === b.treeMetadata &&
    a.gff === b.gff
  )
}

/**
 * Keep IndexedDB holding `unsavedDocuments`, the documents a reload would
 * otherwise lose. That depends on the source, not on the view: a url-loaded
 * alignment still loses a large GFF read from a local file, and a pasted one
 * small enough for the snapshot needs no row at all.
 *
 * A view writes only a row it created this session (`ownsDataStoreRow`); a
 * restored view's first write takes a fresh id, because a copied view or a
 * duplicated session names the same row. Nothing deletes a row when the set
 * empties: the view drops the id, and cleanupOldData ages the row out. A view
 * that never read its row, because the read failed, keeps the id.
 *
 * `lastStoredData` separates "this is new" from "this is what we just wrote",
 * and is recorded whether or not the write succeeded, so a browser refusing
 * IndexedDB (private mode) fails once rather than in a loop.
 */
export function storeDataToIndexedDB(self: JBrowsePluginMsaViewModel) {
  const {
    dataStoreId,
    ownsDataStoreRow,
    isStoringData,
    loadingStoredData,
    lastStoredData,
  } = self
  const data = self.unsavedDocuments
  if (isStoringData || loadingStoredData || sameData(lastStoredData, data)) {
    return
  }
  if (isEmpty(data)) {
    if (lastStoredData) {
      transaction(() => {
        self.setDataStoreId(undefined)
        self.setOwnsDataStoreRow(false)
        self.setLastStoredData(data)
      })
    }
    return
  }

  self.setIsStoringData(true)
  void (async () => {
    try {
      const id =
        dataStoreId && ownsDataStoreRow ? dataStoreId : generateDataStoreId()
      if (await storeMsaData(id, data)) {
        transaction(() => {
          self.setDataStoreId(id)
          self.setOwnsDataStoreRow(true)
        })
      }
    } catch (e) {
      console.error('Failed to store MSA data to IndexedDB:', e)
    } finally {
      transaction(() => {
        self.setLastStoredData(data)
        self.setIsStoringData(false)
      })
    }
  })()
}

/**
 * Same shape as launchBlastIfNeeded, for the ortholog path: the params ARE the
 * request, and `launchCompleted` is what marks it done. They are left in place
 * either way -- on failure so the error stays attributable to a specific
 * request, and on success because they are the only durable statement of what
 * the view is, which is what a stored alignment that expired is rebuilt from.
 * The autorun tracks those two reads alone, so nothing refires until a new
 * request replaces them or a retry clears the mark.
 */
export function launchOrthologsIfNeeded(self: JBrowsePluginMsaViewModel) {
  if (
    self.orthologParams &&
    !self.launchCompleted &&
    !awaitingTranscript(self)
  ) {
    runLaunch({
      self,
      message: 'Resolving orthologs',
      launch: scope => doLaunchOrthologs({ self, scope }),
      // marked rather than dropped: the request is the only durable statement
      // of what this view is, and a view whose stored alignment expired runs it
      // again
      onLaunched: () => {
        self.setLaunchCompleted(true)
      },
    })
  }
}

/**
 * A launch that names its transcript rather than its feature has to wait for
 * the lookup: the query row is that transcript's translation, and the launch
 * cannot start without a query. Both launchers read the same two fields, so
 * the resolver setting `connectedFeature` is what refires them.
 */
function awaitingTranscript(self: JBrowsePluginMsaViewModel) {
  return !!self.connectedTranscript && !self.connectedFeature
}

export function launchBlastIfNeeded(self: JBrowsePluginMsaViewModel) {
  if (self.blastParams && !self.launchCompleted && !awaitingTranscript(self)) {
    runLaunch({
      self,
      message: 'Submitting query',
      launch: scope => doLaunchBlast({ self, scope }),
      onLaunched: () => {
        self.setLaunchCompleted(true)
      },
    })
  }
}

/**
 * Once an accession-bearing alignment is present (fresh from BLAST or restored
 * from cache), fetch NCBI CDD domains for those accessions and overlay them.
 * Runs once per view; the domainsRequested guard prevents refiring when NCBI
 * returns no domains (which leaves the annotation list empty).
 */
export function autoLoadProteinDomains(self: JBrowsePluginMsaViewModel) {
  const { rows, domainsRequested, annotations } = self
  const hasAccessions = self.data.treeMetadata?.includes('"Accession"') ?? false
  if (
    rows.length > 0 &&
    hasAccessions &&
    annotations.length === 0 &&
    !domainsRequested
  ) {
    self.setDomainsRequested(true)
    void (async () => {
      try {
        await loadProteinDomains(self)
      } catch (e) {
        console.error('[msaview-domains] auto-load failed:', e)
      } finally {
        self.setProgress('')
      }
    })()
  }
}

// Resolve the declarative `init` launch contract. msaUrl is handed to
// react-msaview's native filehandle loader (openLocation + progress + abort +
// CORS-proxy) and sniffed for an AlphaFold uniprotId; the bgzip name-indexed
// block is the one source with no native loader, so it's fetched here. Inline
// data and tree URLs arrive as native snapshot props, not via init.
//
// An init that named the indexed block is KEPT rather than cleared, as
// jbrowse-plugin-tview keeps its own: what it resolves to is one alignment
// string, react-msaview drops a document over 50kb from the snapshot, and there
// is no filehandle to reload it from -- so a shared session came back saying the
// alignment had expired. The init is both smaller than what it fetches and the
// only durable statement of what the view is.
export function processInit(self: JBrowsePluginMsaViewModel) {
  const { init } = self
  if (init) {
    const { msaUrl, msaIndexedLocation, msaName, querySeqName } = init
    const indexed = !!(msaIndexedLocation && msaName)
    // a kept init re-runs this on every session restore; the alignment already
    // in hand is the one it would fetch
    if (indexed && self.data.msa) {
      return
    }
    void (async () => {
      try {
        self.setError(undefined)

        if (msaUrl) {
          const id = getUniprotIdFromAlphaFoldUrl(msaUrl)
          if (id) {
            self.setUniprotId(id)
            self.setQuerySeqName('query')
          }
        }
        if (querySeqName) {
          self.setQuerySeqName(querySeqName)
        }

        if (msaUrl) {
          self.setMSAFilehandle({ uri: msaUrl, locationType: 'UriLocation' })
        } else if (msaIndexedLocation && msaName) {
          const fasta = await fetchIndexedMsa({
            location: msaIndexedLocation,
            name: msaName,
          })
          if (fasta) {
            self.setMSA(fasta)
          } else {
            throw new Error(
              `No alignment named ${msaName} in ${msaIndexedLocation.uri}`,
            )
          }
        }

        if (!indexed) {
          self.setInit(undefined)
        }
      } catch (e) {
        self.setError(e)
        console.error(e)
      }
    })()
  }
}

/**
 * Mirror the connected genome view's hover position onto the MSA's hovered
 * column. Returns the autorun body so it can keep a flag tracking whether the
 * MSA's mouseCol was set by this sync: that way an unrelated session hover
 * change clears the column only when the genome put it there, never wiping a
 * column the user is hovering directly in the MSA.
 */
export function syncGenomeHoverToMsaColumn(self: JBrowsePluginMsaViewModel) {
  let genomeDrivenCol = false
  return () => {
    const col = genomeToMSA({ model: self })
    if (col !== undefined) {
      self.setMousePos(col)
      genomeDrivenCol = true
    } else if (genomeDrivenCol) {
      self.setMousePos(undefined)
      genomeDrivenCol = false
    }
  }
}

/**
 * Translate genome regions published by a 3D protein view into this MSA's
 * visible columns. The genome is the only coordinate space the two plugins
 * share, so the hops are genome coord -> protein position (the transcript's g2p
 * map) -> visible column.
 */
function genomeHighlightsToVisibleColumns(
  self: JBrowsePluginMsaViewModel,
  field: 'hoverGenomeHighlights' | 'clickGenomeHighlights',
) {
  const { connectedViewId, transcriptToMsaMap } = self
  if (!transcriptToMsaMap || !hasQueryRow(self)) {
    return []
  }
  const columns = new Set<number>()

  for (const view of getProteinViews(getSession(self).views)) {
    for (const structure of view.structures) {
      if (structure.connectedViewId !== connectedViewId) {
        continue
      }
      for (const { start, end } of structure[field] ?? []) {
        for (const proteinPos of proteinPositionsInRange(
          transcriptToMsaMap,
          start,
          end,
        )) {
          const col = transcriptPosToVisibleCol(self, proteinPos)
          if (col !== undefined) {
            columns.add(col)
          }
        }
      }
    }
  }

  return [...columns]
}

function sameColumns(a: number[] | undefined, b: number[] | undefined) {
  if (!a || !b) {
    return a === b
  }
  return a.length === b.length && a.every((col, i) => col === b[i])
}

/**
 * Mirror a connected 3D protein view's highlights onto the MSA's highlighted
 * columns, from either of the two channels protein3d publishes:
 *
 * - `hoverGenomeHighlights` — the residue under the pointer, transient.
 * - `clickGenomeHighlights` — the domain the user clicked, persistent. Also
 *   what protein3d's declarative `initialSelection` lights on load, so a session
 *   spec that pre-selects a domain in the structure now lands in the alignment
 *   too, instead of the caller having to author the same range a second time as
 *   the MSA's own `highlightColumns`.
 *
 * Highest-priority non-empty source wins: a hover reads as a transient probe on
 * top of the standing selection, and letting it win means moving the pointer
 * over the structure previews a residue without destroying what was selected.
 * Releasing the hover falls back to the click selection, then to the declarative
 * `highlightColumns` seed.
 *
 * Resolving the seed as the last rung of that stack is what replaced a
 * `proteinDriven` flag this function used to carry. The flag existed because the
 * body could not otherwise tell "no protein highlight, leave the seed alone"
 * from "the protein highlight ended, restore the seed", and getting that wrong
 * wiped the seed on the very first run — the bug that made the BRAF/TP53
 * genome-browser links open with no V600/R248 column lit. Now every source is in
 * one expression, so the result depends only on what the sources currently say
 * and there is no ordering to get wrong.
 *
 * A closure remains, but it decides nothing: `written` only suppresses a
 * redundant redraw. Delete it and the highlight is identical, just recomputed
 * more often — where deleting the old flag changed which columns lit.
 */
export function observeProteinHighlights(self: JBrowsePluginMsaViewModel) {
  // The columns this reaction last wrote, kept to skip a write that would not
  // change anything: protein3d recomputes hoverGenomeHighlights on every mouse
  // move over the structure, and moving within one codon yields a fresh array of
  // the same columns, which would redraw the overlay canvas for nothing.
  //
  // Deliberately a closure rather than a read of `self.highlightedColumns` --
  // reading it would put this reaction's own output in its dependency set, so
  // every write would re-trigger it. It converges, but the dependencies should be
  // the sources the highlight derives FROM, not the highlight itself.
  let written: number[] | undefined
  return () => {
    const { connectedViewId, transcriptToMsaMap } = self

    if (!connectedViewId || !transcriptToMsaMap) {
      return
    }

    const hover = genomeHighlightsToVisibleColumns(
      self,
      'hoverGenomeHighlights',
    )
    // Skipping the click channel while hovering is worth the subtlety it costs:
    // a hover recomputes on every mouse move, and a clicked domain can be
    // hundreds of residues, so translating a selection that cannot win would
    // walk thousands of genome coordinates per pointer move.
    //
    // The subtlety is that not reading clickGenomeHighlights leaves it out of
    // this reaction's dependencies until the hover clears. Changing the
    // selection mid-hover therefore does not re-run us -- which is harmless,
    // because the hover would have outranked it anyway, and releasing the hover
    // re-runs and picks up whatever the selection now says.
    const click = hover.length
      ? []
      : genomeHighlightsToVisibleColumns(self, 'clickGenomeHighlights')
    const seed = self.highlightColumns ?? []

    const winner = hover.length ? hover : click.length ? click : seed
    const next = winner.length > 0 ? winner : undefined

    if (!sameColumns(written, next)) {
      written = next
      self.setHighlightedColumns(next)
    }
  }
}

export function runCleanup() {
  cleanupOldData().catch((e: unknown) => {
    console.error('Failed to cleanup old MSA data:', e)
  })
}
