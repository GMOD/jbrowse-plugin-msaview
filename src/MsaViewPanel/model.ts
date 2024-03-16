import { Instance, addDisposer, cast, types } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { MSAModelF } from 'react-msaview'
import { Region } from '@jbrowse/core/util/types/mst'
import {
  Feature,
  SimpleFeature,
  getSession,
  notEmpty,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'

// locals
import { doLaunchBlast } from './doLaunchBlast'
import { generateMap } from './util'
import { genomeToMSA } from './genomeToMSA'
import { msaCoordToGenomeCoord } from './msaCoordToGenomeCoord'

type LGV = LinearGenomeViewModel

type MaybeLGV = LGV | undefined

export interface IRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}
export interface BlastParams {
  blastDatabase: string
  msaAlgorithm: string
  blastProgram: string
  selectedTranscript: Feature
  proteinSequence: string
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
        connectedHighlights: types.array(Region),
        /**
         * #property
         */
        blastParams: types.frozen<BlastParams | undefined>(),

        /**
         * #property
         */
        zoomToBaseLevel: false,
      }),
    )

    .volatile(() => ({
      rid: undefined as string | undefined,
      progress: '',
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
          ? generateMap(new SimpleFeature(self.connectedFeature))
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
    }))

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
            onClick: () => self.setZoomToBaseLevel(!self.zoomToBaseLevel),
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
              self.setProgress('Submitting query')
              const data = await doLaunchBlast({
                self: self as JBrowsePluginMsaViewModel,
              })
              self.setData(data)
              self.setBlastParams(undefined)
              self.setProgress('')
            }
          }),
        )

        // this adds highlights to the genome view when mouse-ing over the MSA
        addDisposer(
          self,
          autorun(() => {
            const { mouseCol, mouseClickCol } = self
            const r1 =
              mouseCol !== undefined
                ? msaCoordToGenomeCoord({ model: self, coord: mouseCol })
                : undefined
            const r2 =
              mouseClickCol !== undefined
                ? msaCoordToGenomeCoord({ model: self, coord: mouseClickCol })
                : undefined
            self.setConnectedHighlights([r1, r2].filter(notEmpty))
          }),
        )

        // nav to genome position after click
        addDisposer(
          self,
          autorun(() => {
            const { connectedView, zoomToBaseLevel, mouseClickCol } = self
            const { assemblyManager } = getSession(self)
            const r2 =
              mouseClickCol !== undefined
                ? msaCoordToGenomeCoord({ model: self, coord: mouseClickCol })
                : undefined

            if (!r2 || !connectedView) {
              return
            }

            if (zoomToBaseLevel) {
              connectedView.navTo(r2)
            } else {
              const r =
                assemblyManager
                  .get(connectedView.assemblyNames[0])
                  ?.getCanonicalRefName(r2.refName) ?? r2.refName
              // @ts-expect-error
              connectedView.centerAt(r2.start, r)
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
