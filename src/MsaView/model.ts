import { MSAModel } from 'react-msaview'
import { Instance, addDisposer, cast, types } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { Region } from '@jbrowse/core/util/types/mst'
import { SimpleFeature, doesIntersect2, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { checkHovered, generateMap } from './util'

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
    .actions(self => ({
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
    }))
    .views(self => ({
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
      get mouseCol2() {
        const session = getSession(self)
        const { transcriptToMsaMap, connectedView } = self
        if (!connectedView?.initialized) {
          return undefined
        }
        const { hovered } = session

        if (!checkHovered(hovered)) {
          return undefined
        }

        const {
          hoverPosition: { coord: hoverCoord, refName: hoverRef },
        } = hovered
        for (const entry of transcriptToMsaMap) {
          const {
            featureStart,
            featureEnd,
            refName,
            proteinEnd,
            proteinStart,
            strand,
          } = entry
          const c = hoverCoord + 1
          if (
            refName === hoverRef &&
            doesIntersect2(featureStart, featureEnd, c, c + 1)
          ) {
            const ret = (strand === -1 ? featureEnd - c : c - featureStart) / 3
            return Math.round(
              strand === -1 ? proteinEnd - ret : ret + proteinStart,
            )
          }
        }
        return undefined
      },
    }))

    .actions(self => ({
      afterCreate() {
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
              if (doesIntersect2(proteinStart, proteinEnd, c, c + 1)) {
                // does not take into account phase, so 'incomplete CDS' might
                // be buggy
                const ret = Math.round((c - proteinStart) * 3)
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
                break
              }
            }
          }),
        )
      },
    }))
}

export type MsaViewStateModel = ReturnType<typeof stateModelFactory>
export type MsaViewModel = Instance<MsaViewStateModel>
