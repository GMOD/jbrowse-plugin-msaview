import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchMsaViewExtensionPointF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LaunchView-MsaView',
    // @ts-expect-error
    async ({
      session,
      data,
      msaFileLocation,
      treeFileLocation,
      connectedViewId,
      connectedFeature,
      displayName,
      colorSchemeName,
      colWidth,
      rowHeight,
      treeAreaWidth,
      treeWidth,
      drawNodeBubbles,
      labelsAlignRight,
      showBranchLen,
      querySeqName,
    }: {
      session: AbstractSessionModel
      data?: { msa: string; tree?: string }
      msaFileLocation?: { uri: string }
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
    }) => {
      if (!data && !msaFileLocation) {
        throw new Error(
          'No MSA data or file location provided when launching MSA view',
        )
      }

      session.addView('MsaView', {
        type: 'MsaView',
        displayName,
        data,
        msaFileLocation,
        treeFileLocation,
        connectedViewId,
        connectedFeature,
        colorSchemeName,
        colWidth,
        rowHeight,
        treeAreaWidth,
        treeWidth,
        drawNodeBubbles,
        labelsAlignRight,
        showBranchLen,
        querySeqName,
      })
    },
  )
}
