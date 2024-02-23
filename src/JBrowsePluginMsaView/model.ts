import { Instance, addDisposer, cast, types } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { Region } from '@jbrowse/core/util/types/mst'
import { Feature, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes'

// locals
import { doLaunchBlast } from './doLaunchBlast'
import extendedModelFactory from './ExtendedReactMSAViewModel'

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
      types.model('MsaView', {
        /**
         * #property
         */
        msaView: types.optional(extendedModelFactory(), { type: 'MsaView' }),
        /**
         * #property
         */
        type: types.literal('MsaView'),
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
      }),
    )
    .volatile(() => ({
      blastParams: undefined as BlastParams | undefined,
      rid: undefined as string | undefined,
      progress: '',
      error: undefined as unknown,
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
              await doLaunchBlast({ self: self as JBrowsePluginMsaViewModel })
              self.setProgress('')
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
