import { BgzfFilehandle } from '@gmod/bgzf-filehandle'
import { openLocation } from '@jbrowse/core/util/io'

// Pull one transcript's whole multiple-alignment out of a single bgzip file
// keyed by NAME. Given the `.fa.gz` uri, the bgzip index (`.gzi`) and name index
// (`.idx`, a TSV `name<TAB>offset<TAB>length` of each block's uncompressed byte
// offset + length) are found by suffix. We fetch the small `.idx` once, look up
// the name, and random-read just that block — already valid FASTA
// (`>hg38\nSEQ\n>panTro4\nSEQ\n...`). One genome-scale alignment serves any gene
// with no per-gene files or coordinates. See react-msaview's gene-explorer.
export async function fetchIndexedMsa({
  location,
  name,
}: {
  location: { uri: string }
  name: string
}) {
  const open = (uri: string) =>
    openLocation({ uri, locationType: 'UriLocation' as const })

  const idxText = await open(`${location.uri}.idx`).readFile('utf8')
  const entry = lookup(idxText, name)
  if (entry) {
    const fh = new BgzfFilehandle({
      filehandle: open(location.uri),
      gziFilehandle: open(`${location.uri}.gzi`),
    })
    const bytes = await fh.read(entry.length, entry.offset)
    return new TextDecoder().decode(bytes).trim()
  }
  return undefined
}

// ids are matched versionless, so version drift between the alignment build and
// the live annotation never breaks the lookup
const versionless = (s: string) => s.replace(/\.\d+$/, '')

function lookup(idxText: string, name: string) {
  const want = versionless(name)
  for (const line of idxText.split('\n')) {
    const [id, offset, length] = line.split('\t')
    if (id && versionless(id) === want) {
      return { offset: Number(offset), length: Number(length) }
    }
  }
  return undefined
}
