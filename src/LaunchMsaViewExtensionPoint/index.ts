import type { OrthologParams } from '../MsaViewPanel/model'
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
  /**
   * Build the alignment from NCBI orthologs at launch time instead of naming a
   * file: `{ taxId, geneCandidates }` is enough, and `taxa` and
   * `proteinSequence` both default (see OrthologParams). This is the launch
   * dialog's Orthologs tab, reachable from a session spec — so a link can say
   * "NLRP1 across species" and the view builds it.
   */
  orthologParams?: OrthologParams
  /**
   * Hide any column gappier than this percentage, 100 being "hide nothing".
   * A native react-msaview property, named here because it is the one setting
   * that decides WHICH columns a freshly launched view opens on: proteins that
   * differ in length put one row's private N-terminal extension at column 0,
   * and everything else is gap there. Anything else react-msaview takes as a
   * snapshot property passes through the same way.
   */
  allowedGappyness?: number
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

      // `orthologParams` is a fourth source, and unlike the other three it names
      // no alignment at all — the view builds one from NCBI at launch, which is
      // the dialog's Orthologs tab reached declaratively.
      if (
        !data &&
        !msaFileLocation &&
        !msaIndexedLocation &&
        !rest.orthologParams
      ) {
        throw new Error(
          'No MSA data, file location or orthologParams provided when launching MSA view',
        )
      }

      // inline data and the tree URL are native react-msaview snapshot props, set
      // directly, and so is orthologParams (the model's own autorun picks it up).
      // Only sources needing launch-time resolution go through `init`: msaUrl
      // (AlphaFold sniff) and the name-indexed bgzip block (no native loader).
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
