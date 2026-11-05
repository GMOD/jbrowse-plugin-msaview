import { BgzfFilehandle } from '@gmod/bgzf-filehandle'

// An `.idx` is a TSV of `name<TAB>offset<TAB>length`, one line per alignment,
// giving the uncompressed byte range of that alignment's rows in a bgzip FASTA
// written with each alignment's rows contiguous. It is what lets a genome-scale
// set be listed and read without the per-row `.fai`, which for UCSC's 100-way
// is 2M lines and 91 MB against the `.idx`'s 20k lines and 211 kB.
export interface MsaIndexEntry {
  name: string
  offset: number
  length: number
}

export function parseMsaIndex(text: string) {
  return text.split('\n').flatMap(line => {
    const [name, offset, length] = line.split('\t')
    return name && offset && length
      ? [{ name, offset: Number(offset), length: Number(length) }]
      : []
  })
}

export async function readMsaBlock({
  entry,
  ...filehandles
}: ConstructorParameters<typeof BgzfFilehandle>[0] & { entry: MsaIndexEntry }) {
  const bytes = await new BgzfFilehandle(filehandles).read(
    entry.length,
    entry.offset,
  )
  return new TextDecoder().decode(bytes).trim()
}
