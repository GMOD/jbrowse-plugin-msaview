export interface MsaViewInitState {
  msaData?: string
  msaUrl?: string
  // a tabix file keyed by genomic locus, where each line packs one transcript's
  // whole multiple-alignment (`name:SEQ;name:SEQ;...`). The transcript's locus
  // comes from the view's connectedFeature, and `msaId` (default the feature's
  // name) selects its line. Lets one genome-scale alignment serve any gene
  // without per-gene files. See react-msaview's gene-explorer.
  msaTabixLocation?: { uri: string }
  msaIndexLocation?: { uri: string }
  msaId?: string
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
