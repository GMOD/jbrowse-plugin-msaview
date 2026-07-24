import { getContainingTrack, getSession } from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'

import LaunchMsaViewDialog from './components/LaunchMsaViewDialog'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearBasicDisplay'
}

// The canvas LinearBasicDisplay (JBrowse >=4.3) exposes the right-clicked
// feature via contextMenuInfo + async fetchFullFeature rather than a synchronous
// feature object.
interface ContextMenuInfo {
  item: { featureId: string; type?: string }
  displayedRegionIndex: number
}

interface DisplayModel {
  contextMenuItems: () => MenuItem[]
  contextMenuInfo?: ContextMenuInfo
  isGeneLike: boolean
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
}

function extendStateModel(stateModel: IAnyModelType) {
  return stateModel.views((self: DisplayModel) => {
    const superContextMenuItems = self.contextMenuItems
    return {
      contextMenuItems() {
        const track = getContainingTrack(self)
        const session = getSession(track)
        const info = self.contextMenuInfo
        const showMsaMenuItem = info && self.isGeneLike
        return [
          ...superContextMenuItems(),
          ...(showMsaMenuItem
            ? [
                {
                  label: 'Launch MSA view',
                  icon: AddIcon,
                  onClick: () => {
                    self
                      .fetchFullFeature(
                        info.item.featureId,
                        info.displayedRegionIndex,
                      )
                      .then(feature => {
                        if (feature) {
                          session.queueDialog(handleClose => [
                            LaunchMsaViewDialog,
                            { model: track, handleClose, feature },
                          ])
                        } else {
                          session.notify(
                            'Could not load feature for MSA view',
                            'warning',
                          )
                        }
                      })
                      .catch((e: unknown) => {
                        session.notifyError(`${e}`, e)
                      })
                  },
                },
              ]
            : []),
        ]
      },
    }
  })
}

export default function LaunchMsaViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (elt: PluggableElementType) => {
      if (isDisplay(elt)) {
        elt.stateModel = extendStateModel(elt.stateModel)
      }
      return elt
    },
  )
}
