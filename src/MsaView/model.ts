import { MSAModel } from 'react-msaview'
import { Instance, addDisposer, cast, types } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { Region } from '@jbrowse/core/util/types/mst'
import { SimpleFeature, doesIntersect2, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { generateMap } from './util'
import { genomeToMSA } from './genomeToMSA'
import { doLaunchBlast } from './doLaunchBlast'

type LGV = LinearGenomeViewModel
type MaybeLGV = LGV | undefined

interface IRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}
/**
 * #stateModel MsaViewPlugin
 * extends
 * - MSAModel from https://github.com/GMOD/react-msaview
 */
export default function stateModelFactory() {
  return types
    .compose(
      'MsaViewPlugin',
      MSAModel,
      types.model({
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
      blastParams: undefined as
        | {
            blastDatabase: string
            msaAlgorithm: string
            blastProgram: string
            selectedTranscript: unknown
            proteinSequence: string
          }
        | undefined,
      rid: undefined as string | undefined,
      progress: '',
    }))
    .actions(self => ({
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
      setBlastParams(args: {
        blastDatabase: string
        program: string
        selectedTranscript: unknown
        msaAlgorithm: string
      }) {
        self.blastParams = args
      },
    }))
    .views(self => ({
      ungappedPositionMap(rowName: string, position: number) {
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
      get processing() {
        return !!self.progress
      },
      /**
       * #getter
       */
      get transcriptToMsaMap() {
        return generateMap(new SimpleFeature(self.connectedFeature))
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

    .actions(self => ({
      afterCreate() {
        // this adds highlights to the genome view when mouse-ing over the MSA
        addDisposer(
          self,
          autorun(() => {
            const { transcriptToMsaMap, mouseCol, connectedView } = self
            if (!connectedView?.initialized || mouseCol === undefined) {
              return
            }
            for (const entry of transcriptToMsaMap) {
              const {
                featureStart,
                featureEnd,
                refName,
                proteinStart,
                proteinEnd,
                strand,
              } = entry
              const c = mouseCol - 1
              const k1 = self.relativePxToBp('QUERY', c) || 0
              const k2 = self.relativePxToBp('QUERY', c + 1) || 0
              if (doesIntersect2(proteinStart, proteinEnd, k1, k2)) {
                // does not take into account phase, so 'incomplete CDS' might
                // be buggy
                const ret = Math.round((k1 - proteinStart) * 3)
                self.setConnectedHighlights([
                  {
                    assemblyName: 'hg38',
                    refName,
                    start:
                      strand === -1 ? featureEnd - ret : featureStart + ret,
                    end:
                      strand === -1
                        ? featureEnd - ret - 3
                        : featureStart + ret + 3,
                  },
                ])
              }
            }
          }),
        )

        addDisposer(
          self,
          autorun(async () => {
            self.setError(undefined)
            self.setProgress('Submitting query')
            if (self.blastParams) {
              await doLaunchBlast({ self })
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
