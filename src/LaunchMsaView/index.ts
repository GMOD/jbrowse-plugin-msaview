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

// Canvas-based LinearBasicDisplay (JBrowse nightly) exposes the right-clicked
// feature via contextMenuInfo + async fetchFullFeature; older releases exposed
// it synchronously as contextMenuFeature.
interface ContextMenuInfo {
  item: { featureId: string; type?: string }
  displayedRegionIndex: number
}

interface DisplayModel {
  contextMenuItems: () => MenuItem[]
  contextMenuInfo?: ContextMenuInfo
  isGeneLike?: boolean
  fetchFullFeature?: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
  contextMenuFeature?: Feature
}

function extendStateModel(stateModel: IAnyModelType) {
  return stateModel.views((self: DisplayModel) => {
    const superContextMenuItems = self.contextMenuItems
    return {
      contextMenuItems() {
        const track = getContainingTrack(self)
        const session = getSession(track)
        const launch = (feature: Feature) => {
          session.queueDialog(handleClose => [
            LaunchMsaViewDialog,
            { model: track, handleClose, feature },
          ])
        }

        const info = self.contextMenuInfo
        const fetchFullFeature = self.fetchFullFeature
        const legacyFeature = self.contextMenuFeature
        const onClick =
          info && fetchFullFeature && self.isGeneLike
            ? () => {
                Promise.resolve(
                  fetchFullFeature(info.item.featureId, info.displayedRegionIndex),
                )
                  .then(feature => {
                    if (feature) {
                      launch(feature)
                    }
                  })
                  .catch((e: unknown) => {
                    session.notifyError(`${e}`, e)
                  })
              }
            : legacyFeature &&
                ['gene', 'mRNA', 'transcript'].includes(
                  String(legacyFeature.get('type')),
                )
              ? () => {
                  launch(legacyFeature)
                }
              : undefined

        return [
          ...superContextMenuItems(),
          ...(onClick
            ? [{ label: 'Launch MSA view', icon: AddIcon, onClick }]
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
