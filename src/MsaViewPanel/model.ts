import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { autorun } from 'mobx'
import { addDisposer, cast, types } from 'mobx-state-tree'
import { MSAModelF } from 'react-msaview'

import { doLaunchBlast } from './doLaunchBlast'
import { genomeToMSA } from './genomeToMSA'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

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
      ungappedCoordMap(rowName: string, position: number) {
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
    }))
    .views(self => ({
      /**
       * #getter
       */
      get mouseCol2(): number | undefined {
        return genomeToMSA({ model: self as JBrowsePluginMsaViewModel })
      },
      /**
       * #getter
       */
      get clickCol2() {
        return undefined
      },
    }))

    .views(self => ({
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
        ]
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
      },
    }))
}

export type JBrowsePluginMsaViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type JBrowsePluginMsaViewModel = Instance<JBrowsePluginMsaViewStateModel>
