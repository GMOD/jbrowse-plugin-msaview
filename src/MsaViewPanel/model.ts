import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { autorun } from 'mobx'
import { addDisposer, cast, types } from 'mobx-state-tree'
import { MSAModelF } from 'react-msaview'

import { doLaunchBlast } from './doLaunchBlast'
import { genomeToMSA } from './genomeToMSA'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'
import { buildAlignmentMaps, runPairwiseAlignment } from './pairwiseAlignment'
import {
  gappedToUngappedPosition,
  mapToRecord,
  ungappedToGappedPosition,
} from './structureConnection'
import { getUniprotIdFromAlphaFoldUrl } from './util'

import type { StructureConnection } from './structureConnection'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

const ConnectStructureDialog = lazy(
  () => import('./components/ConnectStructureDialog'),
)

type LGV = LinearGenomeViewModel

type MaybeLGV = LGV | undefined

/**
 * Highlights residues in connected protein structures based on current MSA hover position
 */
function highlightConnectedStructures(self: JBrowsePluginMsaViewModel) {
  const { mouseCol, connectedProteinViews } = self
  if (connectedProteinViews.length === 0) {
    return
  }

  for (const conn of connectedProteinViews) {
    const structure = conn.proteinView?.structures?.[conn.structureIdx]
    if (!structure) {
      continue
    }

    // Clear highlight if mouse left MSA
    if (mouseCol === undefined) {
      structure.clearHighlightFromExternal?.()
      continue
    }

    const seq = self.getSequenceByRowName(conn.msaRowName)
    if (!seq) {
      continue
    }

    // Convert gapped MSA column to ungapped position
    const msaUngapped = gappedToUngappedPosition(seq, mouseCol)
    if (msaUngapped === undefined) {
      structure.clearHighlightFromExternal?.()
      continue
    }

    // Map to structure position and highlight
    const structurePos = conn.msaToStructure[msaUngapped]
    if (structurePos === undefined) {
      structure.clearHighlightFromExternal?.()
    } else {
      structure.highlightFromExternal?.(structurePos)
    }
  }
}

export interface IRegion {
  refName: string
  start: number
  end: number
}

export interface BlastParams {
  baseUrl: string
  blastDatabase: string
  msaAlgorithm: string
  blastProgram: string
  selectedTranscript: Feature
  proteinSequence: string
}

export interface MsaViewInitState {
  msaData?: string
  msaUrl?: string
  treeData?: string
  treeUrl?: string
  querySeqName?: string
}

/**
 * #stateModel MsaViewPlugin
 * extends
 * - MSAModel from https://github.com/GMOD/react-msaview
 */
export default function stateModelFactory() {
  return types
    .compose(
      BaseViewModel,
      MSAModelF(),
      types.model('MsaView', {
        /**
         * #property
         */
        connectedViewId: types.maybe(types.string),
        /**
         * #property
         */
        connectedFeature: types.frozen(),
        /**
         * #property
         */
        connectedHighlights: types.array(
          types.model({
            refName: types.string,
            start: types.number,
            end: types.number,
          }),
        ),
        /**
         * #property
         */
        blastParams: types.frozen<BlastParams | undefined>(),
        /**
         * #property
         */
        querySeqName: 'QUERY',

        /**
         * #property
         * UniProt ID extracted from AlphaFold MSA URL
         */
        uniprotId: types.maybe(types.string),

        /**
         * #property
         */
        zoomToBaseLevel: false,

        /**
         * #property
         * used for loading the MSA view via session snapshots, e.g.
         * {
         *   "type": "MsaView",
         *   "init": {
         *     "msaUrl": "https://example.com/alignment.fa",
         *     "treeUrl": "https://example.com/tree.nh",
         *     "querySeqName": "ENST00000123_hg38"
         *   }
         * }
         */
        init: types.frozen<MsaViewInitState | undefined>(),

        /**
         * #property
         * connections to protein 3D structure views for synchronized highlighting
         */
        connectedStructures: types.array(types.frozen<StructureConnection>()),
      }),
    )

    .volatile(() => ({
      /**
       * #volatile
       */
      rid: undefined as string | undefined,
      /**
       * #volatile
       */
      progress: '',
      /**
       * #volatile
       */
      error: undefined as unknown,
    }))

    .views(self => ({
      /**
       * #method
       * Get a row by name, returns [name, sequence] or undefined
       */
      getRowByName(rowName: string) {
        return self.rows.find(r => r[0] === rowName)
      },

      /**
       * #method
       * Get the sequence for a row by name
       */
      getSequenceByRowName(rowName: string) {
        return self.rows.find(r => r[0] === rowName)?.[1]
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get transcriptToMsaMap() {
        return self.connectedFeature
          ? genomeToTranscriptSeqMapping(self.connectedFeature)
          : undefined
      },

      /**
       * #getter
       */
      get processing() {
        return !!self.progress
      },

      /**
       * #getter
       */
      get connectedView() {
        const { views } = getSession(self)
        return views.find(f => f.id === self.connectedViewId) as MaybeLGV
      },

      /**
       * #getter
       * Get connected protein views with their full model references
       */
      get connectedProteinViews() {
        const { views } = getSession(self)
        return self.connectedStructures
          .map(conn => {
            const proteinView = views.find(
              (v: any) => v.id === conn.proteinViewId,
            ) as any
            return proteinView ? { ...conn, proteinView } : undefined
          })
          .filter((c): c is StructureConnection & { proteinView: any } => !!c)
      },
    }))

    .views(self => ({
      /**
       * #getter
       * Get the MSA column that corresponds to the currently hovered structure position
       * Returns the first match from any connected structure
       */
      get structureHoverCol(): number | undefined {
        for (const conn of self.connectedProteinViews) {
          const structure = conn.proteinView?.structures?.[conn.structureIdx]
          const structurePos = structure?.hoverPosition?.structureSeqPos
          if (structurePos !== undefined) {
            const msaUngapped = conn.structureToMsa[structurePos]
            if (msaUngapped !== undefined) {
              const seq = self.getSequenceByRowName(conn.msaRowName)
              if (seq) {
                return ungappedToGappedPosition(seq, msaUngapped)
              }
            }
          }
        }
        return undefined
      },
    }))

    .views(self => ({
      /**
       * #getter
       * Returns a secondary highlight column from either:
       * 1. Structure hover (from connected protein 3D view)
       * 2. Genome hover (from connected linear genome view)
       */
      get mouseCol2(): number | undefined {
        // Check structure hover first
        const structureCol = self.structureHoverCol
        if (structureCol !== undefined) {
          return structureCol
        }
        // Fall back to genome hover
        return genomeToMSA({ model: self as JBrowsePluginMsaViewModel })
      },
      /**
       * #getter
       */
      get clickCol2() {
        return undefined
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      setZoomToBaseLevel(arg: boolean) {
        self.zoomToBaseLevel = arg
      },
      /**
       * #action
       */
      setError(e: unknown) {
        self.error = e
      },
      /**
       * #action
       */
      setProgress(arg: string) {
        self.progress = arg
      },
      /**
       * #action
       */
      setRid(arg: string) {
        self.rid = arg
      },
      /**
       * #action
       */
      setConnectedHighlights(r: IRegion[]) {
        self.connectedHighlights = cast(r)
      },
      /**
       * #action
       */
      addToConnectedHighlights(r: IRegion) {
        self.connectedHighlights.push(r)
      },
      /**
       * #action
       */
      clearConnectedHighlights() {
        self.connectedHighlights = cast([])
      },
      /**
       * #action
       */
      setBlastParams(args?: BlastParams) {
        self.blastParams = args
      },
      /**
       * #action
       */
      setInit(arg?: MsaViewInitState) {
        self.init = arg
      },
      /**
       * #action
       */
      setQuerySeqName(arg: string) {
        self.querySeqName = arg
      },
      /**
       * #action
       */
      setUniprotId(arg?: string) {
        self.uniprotId = arg
      },
      /**
       * #action
       */
      handleMsaClick(coord: number) {
        const { connectedView, zoomToBaseLevel } = self
        const { assemblyManager } = getSession(self)
        const r2 = msaCoordToGenomeCoord({ model: self, coord })

        if (!r2 || !connectedView) {
          return
        }

        if (zoomToBaseLevel) {
          connectedView.navTo(r2)
        } else {
          const r =
            assemblyManager
              .get(connectedView.assemblyNames[0]!)
              ?.getCanonicalRefName(r2.refName) ?? r2.refName
          connectedView.centerAt(r2.start, r)
        }
      },

      /**
       * #action
       * Connect to a protein structure for synchronized highlighting
       */
      connectToStructure(
        proteinViewId: string,
        structureIdx: number,
        msaRowName?: string,
      ) {
        const rowName = msaRowName ?? self.querySeqName
        const msaSequence = self.getSequenceByRowName(rowName)
        if (!msaSequence) {
          throw new Error(`MSA row "${rowName}" not found`)
        }

        const ungappedMsaSequence = msaSequence.replaceAll('-', '')

        const { views } = getSession(self)

        const proteinView = views.find(
          (v: any) => v.id === proteinViewId,
        ) as any
        if (!proteinView) {
          throw new Error(`ProteinView "${proteinViewId}" not found`)
        }

        const structure = proteinView.structures?.[structureIdx]
        if (!structure) {
          throw new Error(`Structure at index ${structureIdx} not found`)
        }

        const structureSequence = structure.structureSequences?.[0]
        if (!structureSequence) {
          throw new Error('Structure sequence not available')
        }

        const alignment = runPairwiseAlignment(
          ungappedMsaSequence,
          structureSequence,
        )
        const { seq1ToSeq2, seq2ToSeq1 } = buildAlignmentMaps(alignment)

        const connection: StructureConnection = {
          proteinViewId,
          structureIdx,
          msaRowName: rowName,
          msaToStructure: mapToRecord(seq1ToSeq2),
          structureToMsa: mapToRecord(seq2ToSeq1),
        }

        self.connectedStructures.push(connection)
      },

      /**
       * #action
       * Disconnect from a protein structure
       */
      disconnectFromStructure(proteinViewId: string, structureIdx: number) {
        const idx = self.connectedStructures.findIndex(
          c =>
            c.proteinViewId === proteinViewId &&
            c.structureIdx === structureIdx,
        )
        if (idx !== -1) {
          self.connectedStructures.splice(idx, 1)
        }
      },

      /**
       * #action
       * Disconnect from all protein structures
       */
      disconnectAllStructures() {
        self.connectedStructures.clear()
      },
    }))
    .actions(self => {
      // store reference to the original action from react-msaview
      const superSetMouseClickPos = self.setMouseClickPos.bind(self)

      return {
        /**
         * #action
         * overrides base setMouseClickPos to trigger navigation
         */
        setMouseClickPos(col?: number, row?: number) {
          superSetMouseClickPos(col, row)
          if (col !== undefined) {
            self.handleMsaClick(col)
          }
        },
      }
    })

    .views(self => ({
      /**
       * #method
       * overrides base
       */
      extraViewMenuItems() {
        return [
          {
            label: 'Zoom to base level on click?',
            checked: self.zoomToBaseLevel,
            type: 'checkbox',
            onClick: () => {
              self.setZoomToBaseLevel(!self.zoomToBaseLevel)
            },
          },
          {
            label: 'Connect to protein structure...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ConnectStructureDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          ...(self.connectedStructures.length > 0
            ? [
                {
                  label: 'Disconnect from protein structures',
                  onClick: () => {
                    self.disconnectAllStructures()
                  },
                },
              ]
            : []),
        ]
      },
    }))

    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(async () => {
            if (self.blastParams) {
              try {
                self.setProgress('Submitting query')
                self.setError(undefined)
                const data = await doLaunchBlast({
                  self,
                })
                self.setData(data)
                self.setBlastParams(undefined)
              } catch (e) {
                self.setError(e)
                console.error(e)
              } finally {
                self.setProgress('')
              }
            }
          }),
        )

        // process init parameter for loading MSA from session snapshots
        addDisposer(
          self,
          autorun(async () => {
            const { init } = self
            if (init) {
              try {
                self.setError(undefined)
                const { msaData, msaUrl, treeData, treeUrl, querySeqName } =
                  init

                // Extract uniprotId from AlphaFold MSA URL and set querySeqName
                if (msaUrl) {
                  const id = getUniprotIdFromAlphaFoldUrl(msaUrl)
                  if (id) {
                    self.setUniprotId(id)
                    // AlphaFold MSA files use 'query' as the row name
                    self.setQuerySeqName('query')
                  }
                }

                // User-provided querySeqName takes precedence
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
            }
          }),
        )

        // this adds highlights to the genome view when mouse-ing over the MSA
        addDisposer(
          self,
          autorun(() => {
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
          }),
        )

        // this highlights residues in connected protein structures when mousing over the MSA
        addDisposer(
          self,
          autorun(() => {
            highlightConnectedStructures(self)
          }),
        )

        // auto-connect to compatible ProteinViews
        addDisposer(
          self,
          autorun(() => {
            const { views } = getSession(self)
            const { connectedViewId, uniprotId, rows, connectedStructures } =
              self

            // Need MSA loaded and a uniprotId to auto-connect
            if (!uniprotId || rows.length === 0) {
              return
            }

            // Find ProteinViews that share the same connectedViewId
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

                // Check if structure shares the same genome view connection
                if (structure.connectedViewId !== connectedViewId) {
                  continue
                }

                // Check if structure has matching uniprotId
                if (structure.uniprotId !== uniprotId) {
                  continue
                }

                // Check if already connected
                const alreadyConnected = connectedStructures.some(
                  c =>
                    c.proteinViewId === v.id && c.structureIdx === structureIdx,
                )
                if (alreadyConnected) {
                  continue
                }

                // Check if structure sequence is available
                if (!structure.structureSequences?.[0]) {
                  continue
                }

                // Auto-connect
                try {
                  self.connectToStructure(v.id, structureIdx)
                } catch (e) {
                  console.error('Failed to auto-connect to ProteinView:', e)
                }
              }
            }
          }),
        )
      },
    }))
}

export type JBrowsePluginMsaViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type JBrowsePluginMsaViewModel = Instance<JBrowsePluginMsaViewStateModel>
