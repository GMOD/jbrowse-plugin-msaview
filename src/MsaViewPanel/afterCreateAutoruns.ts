import { getSession } from '@jbrowse/core/util'

import { doLaunchBlast } from './doLaunchBlast'
import { fetchIndexedMsa } from './fetchIndexedMsa'
import { genomeToMSA } from './genomeToMSA'
import { loadProteinDomains } from './loadProteinDomains'
import {
  cleanupOldData,
  generateDataStoreId,
  retrieveMsaData,
  storeMsaData,
} from './msaDataStore'
import {
  gappedToUngappedPosition,
  getProteinViews,
  structureMatchesMsa,
} from './structureConnection'
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
 * returns no domains (which leaves interProAnnotations undefined).
 */
export function autoLoadProteinDomains(self: JBrowsePluginMsaViewModel) {
  const { rows, domainsRequested, interProAnnotations } = self
  const hasAccessions = self.data.treeMetadata?.includes('"Accession"') ?? false
  if (
    rows.length > 0 &&
    hasAccessions &&
    !interProAnnotations &&
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

export function highlightConnectedStructures(self: JBrowsePluginMsaViewModel) {
  const { mouseCol, connectedProteinViews } = self
  if (connectedProteinViews.length === 0) {
    return
  }

  for (const conn of connectedProteinViews) {
    const structure = conn.proteinView.structures[conn.structureIdx]
    if (!structure) {
      continue
    }

    if (mouseCol === undefined) {
      structure.clearHighlightFromExternal?.()
      continue
    }

    const seq = self.getSequenceByRowName(conn.msaRowName)
    if (!seq) {
      continue
    }

    const msaUngapped = gappedToUngappedPosition(seq, mouseCol)
    if (msaUngapped === undefined) {
      structure.clearHighlightFromExternal?.()
      continue
    }

    const structurePos = conn.msaToStructure[msaUngapped]
    if (structurePos === undefined) {
      structure.clearHighlightFromExternal?.()
    } else {
      structure.highlightFromExternal?.(structurePos)
    }
  }
}

export function autoConnectStructures(self: JBrowsePluginMsaViewModel) {
  const { connectedViewId, uniprotId, rows, connectedStructures } = self

  if (rows.length === 0) {
    return
  }

  for (const view of getProteinViews(getSession(self).views)) {
    for (
      let structureIdx = 0;
      structureIdx < view.structures.length;
      structureIdx++
    ) {
      const structure = view.structures[structureIdx]
      if (!structure) {
        continue
      }

      if (!structureMatchesMsa({ structure, connectedViewId, uniprotId })) {
        continue
      }

      const alreadyConnected = connectedStructures.some(
        c => c.proteinViewId === view.id && c.structureIdx === structureIdx,
      )
      if (alreadyConnected) {
        continue
      }

      if (!structure.structureSequences?.[0]) {
        continue
      }

      try {
        self.connectToStructure(view.id, structureIdx)
      } catch (e) {
        console.error('Failed to auto-connect to ProteinView:', e)
      }
    }
  }
}

/**
 * Mirror a connected 3D protein view's hovered residue onto the MSA's
 * highlighted columns. Returns the autorun body and keeps a flag tracking
 * whether the current highlight was set by THIS sync: when a protein hover ends
 * we restore the declarative highlightColumns seed (or clear) rather than
 * blindly wiping it.
 *
 * Without the flag this autorun fires once on creation — with the view connected
 * to a *genome* LGV but no 3D protein structure attached — computes zero columns,
 * and calls setHighlightedColumns(undefined), clobbering the seed that
 * MSAModelF.afterCreate just set from the declarative `highlightColumns`. That is
 * the bug that made the BRAF/TP53 genome-browser links open with no V600/R248
 * column lit (SRC has no highlightColumns, so nothing was there to wipe).
 */
export function observeProteinHighlights(self: JBrowsePluginMsaViewModel) {
  let proteinDriven = false
  return () => {
    const { connectedViewId, transcriptToMsaMap, querySeqName } = self

    if (!connectedViewId || !transcriptToMsaMap) {
      return
    }

    const columns = new Set<number>()

    for (const view of getProteinViews(getSession(self).views)) {
      for (const structure of view.structures) {
        if (structure.connectedViewId !== connectedViewId) {
          continue
        }

        const highlights = structure.hoverGenomeHighlights
        if (!highlights || highlights.length === 0) {
          continue
        }

        const { g2p } = transcriptToMsaMap
        for (const highlight of highlights) {
          for (let coord = highlight.start; coord < highlight.end; coord++) {
            const proteinPos = g2p[coord]
            if (proteinPos !== undefined) {
              const col = self.seqPosToGlobalCol(querySeqName, proteinPos)
              columns.add(col)
            }
          }
        }
      }
    }

    const visibleColumns = Array.from(columns)
      .map(col => self.globalColToVisibleCol(col))
      .filter((col): col is number => col !== undefined)

    if (visibleColumns.length > 0) {
      self.setHighlightedColumns(visibleColumns)
      proteinDriven = true
    } else if (proteinDriven) {
      // our protein-hover highlight ended — fall back to the declarative seed
      // instead of wiping a column the URL/user asked to keep lit
      self.setHighlightedColumns(
        self.highlightColumns?.length ? self.highlightColumns : undefined,
      )
      proteinDriven = false
    }
  }
}

export function runCleanup() {
  cleanupOldData().catch((e: unknown) => {
    console.error('Failed to cleanup old MSA data:', e)
  })
}
