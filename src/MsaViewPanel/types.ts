// Declarative launch contract, resolved once by processInit, then cleared. Only
// sources that need launch-time resolution belong here. Inline data and tree URLs
// do NOT: they are native react-msaview snapshot props (`data`, `treeFilehandle`)
// applied directly from the addView snapshot, no resolution required.
//
// Cross-repo contract: jbrowse-plugin-protein3d builds an MsaView snapshot directly
// with `init: { msaUrl }`, so these keys must stay stable.
export interface MsaViewInitState {
  // resolved here (not as a native msaFilehandle) so the AlphaFold-URL → uniprotId
  // sniff runs once at launch; querySeqName is coupled to it (AlphaFold files name
  // the query row 'query'), which is why it rides along in init rather than being a
  // plain top-level prop.
  msaUrl?: string
  querySeqName?: string
  // a single bgzip `.fa.gz` of per-transcript FASTA blocks; its `.gzi` and name
  // index `.idx` (name<TAB>offset<TAB>length) are found by suffix. `msaName`
  // selects one transcript's block by name (a random read), so one genome-scale
  // alignment serves any gene without per-gene files or coordinates. This is the
  // one alignment source with no native loader. See react-msaview's gene-explorer.
  msaIndexedLocation?: { uri: string }
  msaName?: string
}

export interface MafRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}
