export interface MsaViewInitState {
  msaData?: string
  msaUrl?: string
  // a single bgzip `.fa.gz` of per-transcript FASTA blocks; its `.gzi` and name
  // index `.idx` (name<TAB>offset<TAB>length) are found by suffix. `msaName`
  // selects one transcript's block by name (a random read), so one genome-scale
  // alignment serves any gene without per-gene files or coordinates. See
  // react-msaview's gene-explorer.
  msaIndexedLocation?: { uri: string }
  msaName?: string
  treeData?: string
  treeUrl?: string
  querySeqName?: string
}

export interface MafRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}
