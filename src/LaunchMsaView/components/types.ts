export interface Feat {
  start: number
  end: number
  type?: string
}

export interface SeqState {
  seq: string
  upstream?: string
  downstream?: string
  error?: unknown
}
