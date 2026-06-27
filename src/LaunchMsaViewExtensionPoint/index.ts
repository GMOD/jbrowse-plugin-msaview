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

      // all data sources flow through `init` so processInit is the single place
      // that resolves them (AlphaFold detection, native filehandle loading, etc.)
      session.addView('MsaView', {
        type: 'MsaView',
        ...rest,
        init: {
          msaData: data?.msa,
          treeData: data?.tree,
          msaUrl: msaFileLocation?.uri,
          msaIndexedLocation,
          msaName,
          treeUrl: treeFileLocation?.uri,
          querySeqName,
        },
      })

      return args
    },
  )
}
