import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { autorun } from 'mobx'
import { addDisposer, cast, types } from 'mobx-state-tree'
import { MSAModelF } from 'react-msaview'

import { doLaunchBlast } from './doLaunchBlast'
import { genomeToMSA } from './genomeToMSA'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'
import { runPairwiseAlignment, buildAlignmentMaps } from './pairwiseAlignment'
import {
  gappedToUngappedPosition,
  ungappedToGappedPosition,
  mapToRecord,
} from './structureConnection'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'
import type { StructureConnection } from './structureConnection'

type LGV = LinearGenomeViewModel

type MaybeLGV = LGV | undefined

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
       */
      ungappedToGappedPosition(rowName: string, position: number) {
        const row = self.rows.find(f => f[0] === rowName)
        const seq = row?.[1]
        if (seq && position < seq.length) {
          let i = 0
          let j = 0
          for (; j < position; j++, i++) {
            while (seq[i] === '-') {
              i++
            }
          }
          return i
        }
        return undefined
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const proteinView = views.find((v: any) => v.id === conn.proteinViewId) as any
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
              // Get the MSA row sequence
              const row = self.rows.find(r => r[0] === conn.msaRowName)
              if (row) {
                const gappedPos = ungappedToGappedPosition(row[1], msaUngapped)
                return gappedPos
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
        const msaRow = self.rows.find(r => r[0] === rowName)
        if (!msaRow) {
          throw new Error(`MSA row "${rowName}" not found`)
        }

        const msaSequence = msaRow[1].replace(/-/g, '')

        const { views } = getSession(self)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proteinView = views.find((v: any) => v.id === proteinViewId) as any
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

        const alignment = runPairwiseAlignment(msaSequence, structureSequence)
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
          c => c.proteinViewId === proteinViewId && c.structureIdx === structureIdx,
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
              const session = getSession(self)
              import('./components/ConnectStructureDialog').then(
                ({ default: ConnectStructureDialog }) => {
                  session.queueDialog(handleClose => [
                    ConnectStructureDialog,
                    { model: self, handleClose },
                  ])
                },
              )
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
            const { mouseCol, connectedProteinViews } = self
            if (connectedProteinViews.length === 0) {
              return
            }

            for (const conn of connectedProteinViews) {
              const structure = conn.proteinView?.structures?.[conn.structureIdx]
              if (!structure) {
                continue
              }

              // Clear highlight if mouse left MSA or is on a gap
              if (mouseCol === undefined) {
                structure.clearHighlightFromExternal?.()
                continue
              }

              // Get the MSA row sequence to convert gapped to ungapped
              const row = self.rows.find(r => r[0] === conn.msaRowName)
              if (!row) {
                continue
              }

              const msaUngapped = gappedToUngappedPosition(row[1], mouseCol)
              if (msaUngapped === undefined) {
                structure.clearHighlightFromExternal?.()
                continue
              }

              const structurePos = conn.msaToStructure[msaUngapped]
              if (structurePos !== undefined) {
                structure.highlightFromExternal?.(structurePos)
              } else {
                structure.clearHighlightFromExternal?.()
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
