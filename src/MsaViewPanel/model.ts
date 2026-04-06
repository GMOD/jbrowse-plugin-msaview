import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { autorun } from 'mobx'
import { MSAModelF } from 'react-msaview'

import {
  autoConnectStructures,
  highlightConnectedStructures,
  launchBlastIfNeeded,
  loadStoredData,
  observeProteinHighlights,
  processInit,
  runCleanup,
  storeDataToIndexedDB,
  updateGenomeHighlights,
} from './afterCreateAutoruns'
import { genomeToMSA } from './genomeToMSA'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'
import { buildAlignmentMaps, runPairwiseAlignment } from './pairwiseAlignment'
import { mapToRecord, ungappedToGappedPosition } from './structureConnection'

import type { StructureConnection } from './structureConnection'
import type { MafRegion, MsaViewInitState } from './types'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ConnectStructureDialog = lazy(
  () => import('./components/ConnectStructureDialog'),
)

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
  selectedTranscript?: Feature
  proteinSequence: string
  rid?: string
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
        uniprotId: types.maybe(types.string),

        /**
         * #property
         */
        zoomToBaseLevel: false,

        /**
         * #property
         */
        init: types.frozen<MsaViewInitState | undefined>(),

        /**
         * #property
         */
        connectedStructures: types.array(types.frozen<StructureConnection>()),

        /**
         * #property
         */
        dataStoreId: types.maybe(types.string),

        /**
         * #property
         */
        mafRegion: types.frozen<MafRegion | undefined>(),
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
      /**
       * #volatile
       */
      loadingStoredData: false,
    }))

    .views(self => ({
      /**
       * #method
       */
      getRowByName(rowName: string) {
        return self.rows.find(r => r[0] === rowName)
      },

      /**
       * #method
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
                const globalCol = ungappedToGappedPosition(seq, msaUngapped)
                if (globalCol !== undefined) {
                  return self.globalColToVisibleCol(globalCol)
                }
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
       */
      get mouseCol2(): number | undefined {
        const structureCol = self.structureHoverCol
        if (structureCol !== undefined) {
          return structureCol
        }
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
      setDataStoreId(arg?: string) {
        self.dataStoreId = arg
      },
      /**
       * #action
       */
      setMafRegion(arg?: MafRegion) {
        self.mafRegion = arg
      },
      /**
       * #action
       */
      setLoadingStoredData(arg: boolean) {
        self.loadingStoredData = arg
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
       */
      disconnectAllStructures() {
        self.connectedStructures.clear()
      },
    }))
    .actions(self => {
      const superSetMouseClickPos = self.setMouseClickPos.bind(self)

      return {
        /**
         * #action
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
        runCleanup()
        addDisposer(
          self,
          autorun(() => {
            loadStoredData(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            storeDataToIndexedDB(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            launchBlastIfNeeded(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            processInit(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            updateGenomeHighlights(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            highlightConnectedStructures(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            autoConnectStructures(self)
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            observeProteinHighlights(self)
          }),
        )
      },
    }))
}

export type JBrowsePluginMsaViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type JBrowsePluginMsaViewModel = Instance<JBrowsePluginMsaViewStateModel>

export { type MafRegion, type MsaViewInitState } from './types'
