import { MSAModel } from 'react-msaview'
import { Instance, addDisposer, getParent } from 'mobx-state-tree'
import { autorun } from 'mobx'
import {
  Feature,
  SimpleFeature,
  SimpleFeatureSerialized,
  doesIntersect2,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { genomeToMSA } from './genomeToMSA'
import { generateMap } from './util'

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

export default function stateModelFactory() {
  return MSAModel.actions(self => ({
    /**
     * #action
     */
    setConnectedHighlights(args: IRegion[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getParent<any>(self).setConnectedHighlights(args)
    },
  }))
    .views(self => ({
      /**
       * #method
       */
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
      /**
       * #getter
       */
      get connectedFeature() {
        return getParent<{ connectedFeature: SimpleFeatureSerialized }>(self)
          .connectedFeature
      },
      /**
       * #getter
       */
      get connectedView() {
        return getParent<{ connectedView: LinearGenomeViewModel }>(self)
          .connectedView
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get transcriptToMsaMap() {
        return generateMap(new SimpleFeature(self.connectedFeature))
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get mouseCol2(): number | undefined {
        return genomeToMSA({ model: self as ExtendedReactMSAViewModel })
      },
      /**
       * #getter
       */
      get clickCol2() {
        return undefined
      },
    }))
    .actions(self => ({
      afterAttach() {
        // this adds highlights to the genome view when mouse-ing over the MSA
        addDisposer(
          self,
          autorun(() => {
            const { mouseCol, transcriptToMsaMap, connectedView } = self
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
                const rev = strand === -1
                self.setConnectedHighlights([
                  {
                    assemblyName: 'hg38',
                    refName,
                    start: rev ? featureEnd - ret : featureStart + ret,
                    end: rev ? featureEnd - ret - 3 : featureStart + ret + 3,
                  },
                ])
              }
            }
          }),
        )
      },
    }))
}

export type ExtendedReactMSAViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type ExtendedReactMSAViewModel = Instance<ExtendedReactMSAViewStateModel>
