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
            const ref = f.get('refName').replace('chr', '')
            const s = f.get('start')
            const e = f.get('end')
            const len = e - s
            const op = Math.floor(len / 3)
            const ps = iter
            const pe = iter + op
            iter += op
            return [ref, s, e, ps, pe] as const
          })
      },

      get connectedView() {
        const session = getSession(self)
        return session.views.find(f => f.id === self.connectedViewId) as
          | LGV
          | undefined
      },
    }))

    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(() => {
            const { transcriptToMsaMap, mouseCol, connectedView } = self
            if (connectedView?.initialized && mouseCol !== undefined) {
              for (const entry of transcriptToMsaMap) {
                if (
                  doesIntersect2(entry[3], entry[4], mouseCol, mouseCol + 1)
                ) {
                  const ret = (mouseCol - entry[3]) * 3
                  self.setHighlights([
                    {
                      assemblyName: 'hg38',
                      refName: entry[0],
                      start: entry[1] + ret,
                      end: entry[1] + ret + 3,
                    },
                  ])
                  break
                }
              }
            }
          }),
        )
      },
    }))
}

export type MsaViewStateModel = ReturnType<typeof stateModelFactory>
export type MsaViewModel = Instance<MsaViewStateModel>
