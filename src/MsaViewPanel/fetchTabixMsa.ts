import { TabixIndexedFile } from '@gmod/tabix'
import { openLocation } from '@jbrowse/core/util/io'

// Pull one transcript's whole multiple-alignment out of a locus-keyed tabix
// file. Each line is `refName<TAB>start<TAB>end<TAB>msaId<TAB>packed`, where
// `packed` is `name:SEQ;name:SEQ;...` — no newlines, so the alignment survives
// as a single tabix column. We query the transcript's genomic locus, then pick
// the line whose msaId matches, and rebuild a FASTA string.
export async function fetchTabixMsa({
  location,
  indexLocation,
  msaId,
  refName,
  start,
  end,
}: {
  location: { uri: string }
  indexLocation?: { uri: string }
  msaId: string
  refName: string
  start: number
  end: number
}) {
  const uri = (loc: { uri: string }) =>
    openLocation({ uri: loc.uri, locationType: 'UriLocation' as const })
  const file = new TabixIndexedFile({
    filehandle: uri(location),
    csiFilehandle: uri(indexLocation ?? { uri: `${location.uri}.csi` }),
  })
  const lines: string[] = []
  await file.getLines(refName, start, end, {
    lineCallback: line => {
      lines.push(line)
    },
  })
  const line = lines.find(l => l.split('\t')[3] === msaId)
  return line ? unpack(line) : undefined
}

function unpack(line: string) {
  const packed = line.split('\t')[4] ?? ''
  return packed
    .split(';')
    .filter(Boolean)
    .map(pair => {
      const colon = pair.indexOf(':')
      return `>${pair.slice(0, colon)}\n${pair.slice(colon + 1)}`
    })
    .join('\n')
}
