import { getSession } from '@jbrowse/core/util'

import { doLaunchBlast } from './doLaunchBlast'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'
import {
  cleanupOldData,
  generateDataStoreId,
  retrieveMsaData,
  storeMsaData,
} from './msaDataStore'
import { gappedToUngappedPosition } from './structureConnection'
import { getUniprotIdFromAlphaFoldUrl } from './util'

import type { JBrowsePluginMsaViewModel } from './model'

export function loadStoredData(self: JBrowsePluginMsaViewModel) {
  const { dataStoreId, rows } = self
  if (dataStoreId && rows.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
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
  const { rows, dataStoreId } = self
  if (rows.length > 0 && !dataStoreId) {
    const hasFilehandle = !!(self.msaFilehandle ?? self.treeFilehandle)
    if (hasFilehandle) {
      return
    }

    const msaData = self.data.msa
    const treeData = self.data.tree

    if (msaData || treeData) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
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
        }
      })()
    }
  }
}

export function launchBlastIfNeeded(self: JBrowsePluginMsaViewModel) {
  if (self.blastParams) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
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

export function processInit(self: JBrowsePluginMsaViewModel) {
  const { init } = self
  if (init) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        self.setError(undefined)
        const { msaData, msaUrl, treeData, treeUrl, querySeqName } = init

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

        if (msaData) {
          self.setMSA(msaData)
        } else if (msaUrl) {
          const response = await fetch(msaUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch MSA: ${response.status}`)
          }
          const data = await response.text()
          self.setMSA(data)
        }

        if (treeData) {
          self.setTree(treeData)
        } else if (treeUrl) {
          const response = await fetch(treeUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch tree: ${response.status}`)
          }
          const data = await response.text()
          self.setTree(data)
        }

        self.setInit(undefined)
      } catch (e) {
        self.setError(e)
        console.error(e)
      }
    })()
  }
}

export function updateGenomeHighlights(self: JBrowsePluginMsaViewModel) {
  const { mouseCol, mouseClickCol } = self
  const r1 =
    mouseCol === undefined
      ? undefined
      : msaCoordToGenomeCoord({ model: self, coord: mouseCol })
  const r2 =
    mouseClickCol === undefined
      ? undefined
      : msaCoordToGenomeCoord({ model: self, coord: mouseClickCol })

  self.setConnectedHighlights([r1, r2].filter(f => !!f))
}

export function highlightConnectedStructures(self: JBrowsePluginMsaViewModel) {
  const { mouseCol, connectedProteinViews } = self
  if (connectedProteinViews.length === 0) {
    return
  }

  for (const conn of connectedProteinViews) {
    const structure = conn.proteinView?.structures?.[conn.structureIdx]
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
  const { views } = getSession(self)
  const { connectedViewId, uniprotId, rows, connectedStructures } = self

  if (!uniprotId || rows.length === 0) {
    return
  }

  for (const view of views) {
    const v = view as any
    if (v.type !== 'ProteinView' || !v.structures) {
      continue
    }

    for (
      let structureIdx = 0;
      structureIdx < v.structures.length;
      structureIdx++
    ) {
      const structure = v.structures[structureIdx]

      if (structure.connectedViewId !== connectedViewId) {
        continue
      }

      if (structure.uniprotId !== uniprotId) {
        continue
      }

      const alreadyConnected = connectedStructures.some(
        c => c.proteinViewId === v.id && c.structureIdx === structureIdx,
      )
      if (alreadyConnected) {
        continue
      }

      if (!structure.structureSequences?.[0]) {
        continue
      }

      try {
        self.connectToStructure(v.id, structureIdx)
      } catch (e) {
        console.error('Failed to auto-connect to ProteinView:', e)
      }
    }
  }
}

export function observeProteinHighlights(self: JBrowsePluginMsaViewModel) {
  const { views } = getSession(self)
  const { connectedViewId, transcriptToMsaMap, querySeqName } = self

  if (!connectedViewId || !transcriptToMsaMap) {
    return
  }

  const columns: number[] = []

  for (const view of views) {
    const v = view as any
    if (v.type !== 'ProteinView' || !v.structures) {
      continue
    }

    for (const structure of v.structures) {
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
            if (!columns.includes(col)) {
              columns.push(col)
            }
          }
        }
      }
    }
  }

  const visibleColumns = columns
    .map(col => self.globalColToVisibleCol(col))
    .filter((col): col is number => col !== undefined)

  self.setHighlightedColumns(
    visibleColumns.length > 0 ? visibleColumns : undefined,
  )
}

export function runCleanup() {
  cleanupOldData().catch((e: unknown) => {
    console.error('Failed to cleanup old MSA data:', e)
  })
}
