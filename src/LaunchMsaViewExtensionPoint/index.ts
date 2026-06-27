import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

interface LaunchMsaViewArgs {
  session: AbstractSessionModel
  data?: { msa: string; tree?: string }
  msaFileLocation?: { uri: string }
  msaIndexedLocation?: { uri: string }
  msaName?: string
  treeFileLocation?: { uri: string }
  connectedViewId?: string
  connectedFeature?: Record<string, unknown>
  displayName?: string
  colorSchemeName?: string
  colWidth?: number
  rowHeight?: number
  treeAreaWidth?: number
  treeWidth?: number
  drawNodeBubbles?: boolean
  labelsAlignRight?: boolean
  showBranchLen?: boolean
  querySeqName?: string
  highlightColumns?: number[]
}

export default function LaunchMsaViewExtensionPointF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LaunchView-MsaView',
    (args: LaunchMsaViewArgs) => {
      const {
        session,
        data,
        msaFileLocation,
        msaIndexedLocation,
        msaName,
        treeFileLocation,
        querySeqName,
        ...rest
      } = args

      if (!data && !msaFileLocation && !msaIndexedLocation) {
        throw new Error(
          'No MSA data or file location provided when launching MSA view',
        )
      }

      // inline data and the tree URL are native react-msaview snapshot props, set
      // directly. Only sources needing launch-time resolution go through `init`:
      // msaUrl (AlphaFold sniff) and the name-indexed bgzip block (no native loader).
      session.addView('MsaView', {
        type: 'MsaView',
        ...rest,
        data,
        ...(treeFileLocation
          ? {
              treeFilehandle: {
                ...treeFileLocation,
                locationType: 'UriLocation',
              },
            }
          : {}),
        init: {
          msaUrl: msaFileLocation?.uri,
          msaIndexedLocation,
          msaName,
          querySeqName,
        },
      })

      return args
    },
  )
}
