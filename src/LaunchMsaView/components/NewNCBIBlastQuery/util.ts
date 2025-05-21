export function makeId(h: { accession: string; sciname: string }) {
  return `${h.accession}-${h.sciname.replaceAll(' ', '_')}`
}

export function strip(s: string) {
  return s.replace('-', '')
}

export function shorten(str: string, len: number) {
  return typeof str === 'string' && str.length > len
    ? `${str.slice(0, Math.max(0, len))}...`
    : str
}
