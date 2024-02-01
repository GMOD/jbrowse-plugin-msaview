export function makeId(h: { accession: string; sciname: string }) {
  return `${h.accession}-${h.sciname.replaceAll(' ', '_')}`
}

export function strip(s: string) {
  return s.replace('-', '')
}
