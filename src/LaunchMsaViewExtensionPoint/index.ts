import { launchMsaView } from '../utils/launchMsaView'

import type { BlastParams, OrthologParams } from '../MsaViewPanel/model'
import type { MsaViewPlacement } from '../utils/workspaces'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ColumnTrackSpec, Highlight } from 'react-msaview'

interface LaunchMsaViewArgs {
  session: AbstractSessionModel
  data?: { msa: string; tree?: string }
  msaFileLocation?: { uri: string }
  msaIndexedLocation?: { uri: string }
  msaName?: string
  treeFileLocation?: { uri: string }
  connectedViewId?: string
  connectedFeature?: Record<string, unknown>
  /**
   * The short form of `connectedFeature`: a transcript id looked up in the
   * connected genome view's open tracks at launch, and translated to become
   * the query row of a `searchParams` or `orthologParams` launch that names
   * no `proteinSequence` of its own.
   */
  connectedTranscript?: string
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
   * Labeled highlights in 1-based inclusive coordinates: `{row, start, end}`
   * for residues of that row, `{start, end}` for alignment columns, `{rows}`
   * for whole rows. Prefer this over `highlightColumns`: a residue range stays
   * put when `allowedGappyness` changes the visible columns.
   */
  highlights?: Highlight[]
  /** per-column tracks supplied as data, see react-msaview's docs/layers.md */
  columnTracks?: ColumnTrackSpec[]
  /**
   * Build the alignment from NCBI orthologs at launch time instead of naming a
   * file: `{ taxId, geneCandidates }` is enough, and `taxa` and
   * `proteinSequence` both default (see OrthologParams). This is the launch
   * dialog's Orthologs tab, reachable from a session spec — so a link can say
   * "NLRP1 across species" and the view builds it.
   */
  orthologParams?: OrthologParams
  /**
   * Search for the alignment at launch: the dialog's BLAST tab reached
   * declaratively. `{ searchProgram: 'phmmer', blastDatabase: 'rp15',
   * accession: 'P04637' }` is a whole request. The query comes from
   * `proteinSequence`, else fetched for `accession`, else translated from the
   * view's `connectedTranscript`. Stored on the model as `blastParams`, the
   * name the dialog has always used.
   */
  searchParams?: BlastParams
  /**
   * Hide any column gappier than this percentage, 100 being "hide nothing".
   * A native react-msaview property, named here because it is the one setting
   * that decides WHICH columns a freshly launched view opens on: proteins that
   * differ in length put one row's private N-terminal extension at column 0,
   * and everything else is gap there. Anything else react-msaview takes as a
   * snapshot property passes through the same way.
   */
  allowedGappyness?: number
  /**
   * Where the view lands: `stack` (default), `splitRight` or `newTab`. The
   * declarative half of the launch — a link states the arrangement it wants
   * instead of the reader dragging the view into place.
   *
   * The default is `stack` and has to stay `stack`: it is what every link
   * written before this key existed already does, and the only thing an
   * embedded session can do. The launch DIALOG defaults to `splitRight`
   * instead (see `DEFAULT_LAUNCH_PLACEMENT`), because a launch from a gene
   * feature is a connected pair and reads as a split.
   *
   * A spec that arranges more than these two views should use the host's own
   * `layout` key instead, which states the whole tree and is applied after
   * every view in the spec has launched. Both may be given; `layout` wins,
   * being the later and more specific statement.
   */
  placement?: MsaViewPlacement
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
        searchParams,
        ...rest
      } = args

      // `orthologParams` and `searchParams` name no alignment at all — the
      // view builds one at launch, which is the dialog's Orthologs and BLAST
      // tabs reached declaratively.
      if (
        !data &&
        !msaFileLocation &&
        !msaIndexedLocation &&
        !rest.orthologParams &&
        !searchParams
      ) {
        throw new Error(
          'No MSA data, file location, orthologParams or searchParams provided when launching MSA view',
        )
      }

      // inline data and the tree URL are native react-msaview snapshot props, set
      // directly, and so is orthologParams (the model's own autorun picks it up).
      // Only sources needing launch-time resolution go through `init`: msaUrl
      // (AlphaFold sniff) and the name-indexed bgzip block (no native loader).
      //
      // An init whose every field is undefined is still a truthy object, and
      // MsaViewPanel reads any init as a launch in flight, so an inline-data
      // launch flashed "Loading alignment" until processInit cleared it.
      const init = {
        msaUrl: msaFileLocation?.uri,
        msaIndexedLocation,
        msaName,
        querySeqName,
      }
      launchMsaView(session, {
        ...rest,
        ...(searchParams ? { blastParams: searchParams } : {}),
        data,
        ...(treeFileLocation
          ? {
              treeFilehandle: {
                ...treeFileLocation,
                locationType: 'UriLocation',
              },
            }
          : {}),
        ...(Object.values(init).some(v => v !== undefined) ? { init } : {}),
      })

      return args
    },
  )
}
