export interface Feat {
  start: number
  end: number
  type?: string
  // GFF phase of the first coding base; convertCodingSequenceToPeptides reads it
  // off cds[0] to start translation in the right frame
  phase?: number
}

export interface SeqState {
  seq: string
}
