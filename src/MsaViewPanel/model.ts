import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { autorun } from 'mobx'
import { MSAModelF } from 'react-msaview'

// re-exported so the inferred (composed) state-model type can name MSAFormat
// from msa-parsers when emitting declarations (avoids TS2883 portability error)
export type { MSAFormat } from 'msa-parsers'

import {
  autoLoadProteinDomains,
  launchBlastIfNeeded,
  loadStoredData,
  observeProteinHighlights,
  processInit,
  runCleanup,
  storeDataToIndexedDB,
  syncGenomeHoverToMsaColumn,
} from './afterCreateAutoruns'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'

import type { MafRegion, MsaViewInitState } from './types'
import type {
  BlastDatabase,
  BlastProgram,
  MsaAlgorithm,
} from '../LaunchMsaView/components/NCBIBlastQuery/consts'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

type MaybeLGV = LGV | undefined

export interface IRegion {
  refName: string
  start: number
  end: number
}

export interface BlastParams {
  baseUrl: string
  blastDatabase: BlastDatabase
  msaAlgorithm: MsaAlgorithm
  blastProgram: BlastProgram
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
        dataStoreId: types.maybe(types.string),

        /**
         * #property
         */
        mafRegion: types.frozen<MafRegion | undefined>(),
      }),
    )

    .volatile(
      (): {
        rid: string | undefined
        progress: string
        error: unknown
        loadingStoredData: boolean
        isStoringData: boolean
        domainsRequested: boolean
      } => ({
        /**
         * #volatile
         */
        rid: undefined,
        /**
         * #volatile
         */
        progress: '',
        /**
         * #volatile
         */
        error: undefined,
        /**
         * #volatile
         */
        loadingStoredData: false,
        /**
         * #volatile
         */
        isStoringData: false,
        /**
         * #volatile
         * guards the one-shot auto-fetch of protein domains so it doesn't refire
         * when NCBI returns no domains (leaving interProAnnotations undefined)
         */
        domainsRequested: false,
      }),
    )

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
      get connectedView() {
        const { views } = getSession(self)
        return views.find(f => f.id === self.connectedViewId) as MaybeLGV
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get connectedHighlights(): IRegion[] {
        const { mouseCol, mouseClickCol } = self
        return [
          mouseCol === undefined
            ? undefined
            : msaCoordToGenomeCoord({ model: self, coord: mouseCol }),
          mouseClickCol === undefined
            ? undefined
            : msaCoordToGenomeCoord({ model: self, coord: mouseClickCol }),
        ].filter((r): r is IRegion => r !== undefined)
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
      setIsStoringData(arg: boolean) {
        self.isStoringData = arg
      },
      /**
       * #action
       */
      setDomainsRequested(arg: boolean) {
        self.domainsRequested = arg
      },
      /**
       * #action
       */
      handleMsaClick(coord: number) {
        const { connectedView, zoomToBaseLevel } = self
        const r2 = msaCoordToGenomeCoord({ model: self, coord })

        if (!r2 || !connectedView) {
          return
        }

        // Use the genome coord's own refName for both nav paths — it matches the
        // connected view's displayed regions. Canonicalizing (e.g. "chr17"->"17")
        // can miss a view whose regions are an alias (same as the bpToPx path).
        if (zoomToBaseLevel) {
          connectedView.navTo(r2)
        } else {
          connectedView.centerAt(r2.start, r2.refName)
        }
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
        ]
      },
    }))

    .actions(self => ({
      afterCreate() {
        runCleanup()
        for (const fn of [
          loadStoredData,
          storeDataToIndexedDB,
          launchBlastIfNeeded,
          processInit,
          autoLoadProteinDomains,
        ]) {
          addDisposer(
            self,
            autorun(() => {
              fn(self)
            }),
          )
        }
        // these two keep per-reaction state across runs (a "did I set it?" flag),
        // so they're factories returning the autorun body rather than plain fns
        addDisposer(self, autorun(syncGenomeHoverToMsaColumn(self)))
        addDisposer(self, autorun(observeProteinHighlights(self)))
      },
    }))
}

export type JBrowsePluginMsaViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type JBrowsePluginMsaViewModel = Instance<JBrowsePluginMsaViewStateModel>

export { type MafRegion, type MsaViewInitState } from './types'

export function isMsaView(view: {
  type: string
}): view is JBrowsePluginMsaViewModel {
  return view.type === 'MsaView'
}
