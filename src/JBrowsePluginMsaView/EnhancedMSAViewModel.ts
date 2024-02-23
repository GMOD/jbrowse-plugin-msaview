import { MSAModel } from 'react-msaview'
import { types } from 'mobx-state-tree'
import { genomeToMSA } from './genomeToMSA'

export default function stateModelFactory() {
  return types
    .compose(MSAModel, types.model({}))
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
}
