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

interface IRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

export default function stateModelFactory() {
  return types
    .compose(
      'MsaView',
      MSAModel,
      types.model({
        connectedViewId: types.maybe(types.string),
        connectedFeature: types.frozen(),
        connectedHighlights: types.array(Region),
      }),
    )
    .actions(self => ({
      setHighlights(r: IRegion[]) {
        self.connectedHighlights = cast(r)
      },
      addToHighlights(r: IRegion) {
        self.connectedHighlights.push(r)
      },
      clearHighlights() {
        self.connectedHighlights = cast([])
      },
    }))
    .views(self => ({
      get transcriptToMsaMap() {
        const f = new SimpleFeature(self.connectedFeature)
        let iter = 0

        const subs: Feature[] = f.get('subfeatures') || []
        return subs
          .filter(f => f.get('type') === 'CDS')
          .map(f => {
            const refName = f.get('refName').replace('chr', '')
            const featureStart = f.get('start')
            const featureEnd = f.get('end')
            const len = featureEnd - featureStart
            const op = Math.floor(len / 3)
            const proteinStart = iter
            const proteinEnd = iter + op
            iter += op
            return {
              refName,
              featureStart,
              featureEnd,
              proteinStart,
              proteinEnd,
            } as const
          })
      },

      get connectedView() {
        const session = getSession(self)
        return session.views.find(f => f.id === self.connectedViewId) as
          | LGV
          | undefined
      },
    }))
    .views(self => ({
      get mouseCol2() {
        const session = getSession(self)
        const { transcriptToMsaMap, connectedView } = self
        if (!connectedView?.initialized) {
          return
        }
        const { hovered } = session
        if (!hovered) {
          return undefined
        }
        // @ts-expect-error
        const { hoverPosition } = hovered
        for (const entry of transcriptToMsaMap) {
          const {
            featureStart,
            featureEnd,
            refName,
            proteinStart,
            proteinEnd,
          } = entry
          if (
            refName === hoverPosition.refName &&
            doesIntersect2(
              featureStart,
              featureEnd,
              hoverPosition.coord,
              hoverPosition.coord + 1,
            )
          ) {
            const ret = (hoverPosition.coord - featureStart) / 3
            return ret
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
              if (
                doesIntersect2(proteinStart, proteinEnd, mouseCol, mouseCol + 1)
              ) {
                const ret = (mouseCol - proteinStart) * 3
                self.setHighlights([
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
