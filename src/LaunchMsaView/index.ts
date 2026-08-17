import { getContainingTrack, getSession } from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'

import LaunchMsaViewDialog from './components/LaunchMsaViewDialog'
import { launchTarget } from './launchTarget'

import type { DisplayModel } from './launchTarget'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearBasicDisplay'
}

// Walking to the track and the session at click time, not while the menu is
// built: contextMenuItems runs on every right-click and, on a host whose base
// method reads `this`, is the one place a plugin can take the whole menu down.
// Keeping it to a pure read of the display is also what lets a test call it.
function openDialog(
  self: DisplayModel,
  feature: () => Promise<Feature | undefined>,
) {
  const track = getContainingTrack(self)
  const session = getSession(track)
  feature()
    .then(f => {
      if (f) {
        session.queueDialog(handleClose => [
          LaunchMsaViewDialog,
          { model: track, handleClose, feature: f },
        ])
      } else {
        session.notify('Could not load feature for MSA view', 'warning')
      }
    })
    .catch((e: unknown) => {
      session.notifyError(`${e}`, e)
    })
}

export function extendStateModel(stateModel: IAnyModelType) {
  return stateModel.views((self: DisplayModel) => {
    const superContextMenuItems = self.contextMenuItems
    return {
      contextMenuItems() {
        const target = launchTarget(self)
        return [
          // .call(self), not a bare call: a host's own contextMenuItems may
          // reach its sibling views through `this`, which is undefined when the
          // captured super is invoked detached. It throws, the ErrorBoundary the
          // menu builds inside swallows it, and the user right-clicks a feature
          // and gets no menu at all -- the host's own rows gone too, which is
          // worse than this plugin contributing nothing. jbrowse-components hit
          // exactly this with `this.isGeneLike` and fixed its side in
          // 104bbfc581, but a plugin cannot choose which host build it runs on.
          ...superContextMenuItems.call(self),
          ...(target
            ? [
                {
                  label: 'Launch MSA view',
                  icon: AddIcon,
                  onClick: () => {
                    openDialog(self, target)
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
