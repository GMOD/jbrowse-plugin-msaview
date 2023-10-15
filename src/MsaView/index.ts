import PluginManager from '@jbrowse/core/PluginManager'
import { MSAModel, MSAView } from 'react-msaview'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { addDisposer, types } from 'mobx-state-tree'
import { autorun } from 'mobx'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Feature } from '@jbrowse/core/util'

const stateModel = types
  .compose(MSAModel, types.model())
  .volatile(() => ({
    connectedView: undefined as undefined | LinearGenomeViewModel,
    feature: undefined as undefined | Feature,
  }))
  .actions(self => ({
    setExtraData({
      view,
      feature,
    }: {
      view: LinearGenomeViewModel
      feature: Feature
    }) {
      self.connectedView = view
      self.feature = feature
    },
    afterCreate() {
      console.log('derived create')
      addDisposer(
        self,
        autorun(() => {
          console.log(self.mouseCol, self.mouseRow)
          console.log(self.connectedView?.visibleLocStrings)
        }),
      )
    },
  }))

export default function MsaViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'MsaView',
        stateModel,
        ReactComponent: MSAView,
      }),
  )
}
