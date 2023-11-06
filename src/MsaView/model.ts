import { MSAModel } from 'react-msaview'
import { Instance, addDisposer, cast, types } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { Region } from '@jbrowse/core/util/types/mst'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import {
  Feature,
  SimpleFeature,
  doesIntersect2,
  getSession,
} from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel
type MaybeLGV = LGV | undefined

interface IRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

function checkHovered(hovered: unknown): hovered is {
  hoverFeature: Feature
  hoverPosition: { coord: number; refName: string }
} {
  return (
    !!hovered &&
    typeof hovered == 'object' &&
    'hoverFeature' in hovered &&
    'hoverPosition' in hovered
  )
}

export default function stateModelFactory() {
  return types
    .compose(
      'MsaView',
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
        const f = new SimpleFeature(self.connectedFeature)
        let iter = 0

        const strand = f.get('strand')
        const children = f.children() ?? []
        const subs = strand === -1 ? children.reverse() : children

        return subs
          .filter(f => f.get('type') === 'CDS')
          .sort((a, b) => a.get('start') - b.get('start'))
          .map(f => {
            const refName = f.get('refName').replace('chr', '')
            const featureStart = f.get('start')
            const featureEnd = f.get('end')
            const phase = f.get('phase')
            const len = featureEnd - featureStart
            const op = len / 3
            const proteinStart = iter
            const proteinEnd = iter + op
            iter += op
            return {
              refName,
              featureStart,
              featureEnd,
              proteinStart,
              proteinEnd,
              phase,
              strand,
            } as const
          })
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
          const { featureStart, featureEnd, refName, proteinStart } = entry
          const c = hoverCoord + 1
          if (
            refName === hoverRef &&
            doesIntersect2(featureStart, featureEnd, c, c + 1)
          ) {
            const ret = (c - featureStart) / 3
            return Math.round(ret + proteinStart)
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
              const { featureStart, refName, proteinStart, proteinEnd } = entry
              const c = mouseCol - 1
              if (doesIntersect2(proteinStart, proteinEnd, c, c + 1)) {
                // does not take into account phase, so 'incomplete CDS' might
                // be buggy
                const ret = Math.round((c - proteinStart) * 3)
                self.setConnectedHighlights([
                  {
                    assemblyName: 'hg38',
                    refName,
                    start: featureStart + ret,
                    end: featureStart + ret + 3,
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
