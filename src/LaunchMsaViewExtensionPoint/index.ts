import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchMsaViewExtensionPointF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LaunchView-MsaView',
    // @ts-expect-error
    ({
      session,
      data,
      msaFileLocation,
      msaTabixLocation,
      msaIndexLocation,
      msaId,
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
      highlightColumns,
    }: {
      session: AbstractSessionModel
      data?: { msa: string; tree?: string }
      msaFileLocation?: { uri: string }
      msaTabixLocation?: { uri: string }
      msaIndexLocation?: { uri: string }
      msaId?: string
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
    }) => {
      if (!data && !msaFileLocation && !msaTabixLocation) {
        throw new Error(
          'No MSA data or file location provided when launching MSA view',
        )
      }

      session.addView('MsaView', {
        type: 'MsaView',
        displayName,
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
        highlightColumns,
        init: {
          msaData: data?.msa,
          treeData: data?.tree,
          msaUrl: msaFileLocation?.uri,
          msaTabixLocation,
          msaIndexLocation,
          msaId,
          treeUrl: treeFileLocation?.uri,
          querySeqName,
        },
      })
    },
  )
}
