import { openLocation } from '@jbrowse/core/util/io'

import { parseMsaIndex, readMsaBlock } from '../utils/msaIndex'

// Pull one transcript's whole multiple-alignment out of a single bgzip file
// keyed by NAME. Given the `.fa.gz` uri, the bgzip index (`.gzi`) and name index
// (`.idx`) are found by suffix. We fetch the small `.idx` once, look up the
// name, and random-read just that block — already valid FASTA
// (`>hg38\nSEQ\n>panTro4\nSEQ\n...`). One genome-scale alignment serves any gene
// with no per-gene files or coordinates.
export async function fetchIndexedMsa({
  location,
  name,
}: {
  location: { uri: string }
  name: string
}) {
  const open = (uri: string) =>
    openLocation({ uri, locationType: 'UriLocation' as const })

  const want = versionless(name)
  const entry = parseMsaIndex(
    await open(`${location.uri}.idx`).readFile('utf8'),
  ).find(e => versionless(e.name) === want)
  return entry
    ? readMsaBlock({
        filehandle: open(location.uri),
        gziFilehandle: open(`${location.uri}.gzi`),
        entry,
      })
    : undefined
}

// ids are matched versionless, so version drift between the alignment build and
// the live annotation never breaks the lookup
const versionless = (s: string) => s.replace(/\.\d+$/, '')
