export interface Feat {
  start: number
  end: number
  type: string
}

export function stitch(subfeats: Feat[], sequence: string) {
  return subfeats.map(sub => sequence.slice(sub.start, sub.end)).join('')
}

export function calculateProteinSequence({
  cds,
  sequence,
  codonTable,
}: {
  cds: Feat[]
  sequence: string
  codonTable: Record<string, string>
}) {
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }
  return protein
}
