import { getSession } from '@jbrowse/core/util'

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
import { getProteinViews } from './structureConnection'
import { getUniprotIdFromAlphaFoldUrl } from './util'

import type { JBrowsePluginMsaViewModel } from './model'

export function loadStoredData(self: JBrowsePluginMsaViewModel) {
  const { dataStoreId, rows } = self
  if (dataStoreId && rows.length === 0) {
    void (async () => {
      try {
        self.setLoadingStoredData(true)
        const storedData = await retrieveMsaData(dataStoreId)
        if (storedData) {
          if (storedData.msa) {
            self.setMSA(storedData.msa)
          }
          if (storedData.tree) {
            self.setTree(storedData.tree)
          }
          if (storedData.treeMetadata) {
            self.setTreeMetadata(storedData.treeMetadata)
          }
        }
      } catch (e) {
        console.error('Failed to load MSA data from IndexedDB:', e)
      } finally {
        self.setLoadingStoredData(false)
      }
    })()
  }
}

export function storeDataToIndexedDB(self: JBrowsePluginMsaViewModel) {
  const { rows, dataStoreId, isStoringData } = self
  if (rows.length > 0 && !dataStoreId && !isStoringData) {
    if (self.msaFilehandle || self.treeFilehandle) {
      return
    }

    const msaData = self.data.msa
    const treeData = self.data.tree

    if (msaData || treeData) {
      // mark as storing synchronously so re-runs of this autorun (e.g. when
      // data observables change while the write is pending) don't kick off a
      // duplicate write and leave an orphan IndexedDB entry
      self.setIsStoringData(true)
      void (async () => {
        try {
          const newId = generateDataStoreId()
          const success = await storeMsaData(newId, {
            msa: msaData,
            tree: treeData,
            treeMetadata: self.data.treeMetadata,
          })
          if (success) {
            self.setDataStoreId(newId)
          }
        } catch (e) {
          console.error('Failed to store MSA data to IndexedDB:', e)
        } finally {
          self.setIsStoringData(false)
        }
      })()
    }
  }
}

/**
 * Same shape as launchBlastIfNeeded, for the ortholog path: the params ARE the
 * request, and clearing them on success is what marks it done. They are left in
 * place on failure so the error stays attributable to a specific request; the
 * autorun's only tracked read is orthologParams itself, so nothing refires
 * until a new request replaces them.
 */
export function launchOrthologsIfNeeded(self: JBrowsePluginMsaViewModel) {
  if (self.orthologParams) {
    void (async () => {
      try {
        self.setProgress('Resolving orthologs')
        self.setError(undefined)
        const data = await doLaunchOrthologs({ self })
        self.setData(data)
        self.setOrthologParams(undefined)
      } catch (e) {
        self.setError(e)
        console.error(e)
      } finally {
        self.setProgress('')
      }
    })()
  }
}

export function launchBlastIfNeeded(self: JBrowsePluginMsaViewModel) {
  if (self.blastParams) {
    void (async () => {
      try {
        self.setProgress('Submitting query')
        self.setError(undefined)
        const data = await doLaunchBlast({ self })
        self.setData(data)
        self.setBlastParams(undefined)
      } catch (e) {
        self.setError(e)
        console.error(e)
      } finally {
        self.setProgress('')
      }
    })()
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

// Resolve the declarative `init` launch contract once, then clear it. msaUrl is
// handed to react-msaview's native filehandle loader (openLocation + progress +
// abort + CORS-proxy) and sniffed for an AlphaFold uniprotId; the bgzip
// name-indexed block is the one source with no native loader, so it's fetched
// here. Inline data and tree URLs arrive as native snapshot props, not via init.
export function processInit(self: JBrowsePluginMsaViewModel) {
  const { init } = self
  if (init) {
    const { msaUrl, msaIndexedLocation, msaName, querySeqName } = init
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

        self.setInit(undefined)
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
 * map) -> global alignment column -> visible column.
 */
function genomeHighlightsToVisibleColumns(
  self: JBrowsePluginMsaViewModel,
  field: 'hoverGenomeHighlights' | 'clickGenomeHighlights',
) {
  const { connectedViewId, transcriptToMsaMap, querySeqName } = self
  if (!transcriptToMsaMap) {
    return []
  }
  const { g2p } = transcriptToMsaMap
  const columns = new Set<number>()

  for (const view of getProteinViews(getSession(self).views)) {
    for (const structure of view.structures) {
      if (structure.connectedViewId !== connectedViewId) {
        continue
      }
      for (const highlight of structure[field] ?? []) {
        for (let coord = highlight.start; coord < highlight.end; coord++) {
          const proteinPos = g2p[coord]
          if (proteinPos !== undefined) {
            columns.add(self.seqPosToGlobalCol(querySeqName, proteinPos))
          }
        }
      }
    }
  }

  return [...columns]
    .map(col => self.globalColToVisibleCol(col))
    .filter((col): col is number => col !== undefined)
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
