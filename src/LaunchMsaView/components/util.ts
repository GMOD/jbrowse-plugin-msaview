import type { TaxonomyInfo } from '../../utils/taxonomyNames'

export function makeId(
  h: { accession: string; sciname: string; taxid?: number },
  taxonomyInfo?: Map<number, TaxonomyInfo>,
) {
  let speciesName = h.sciname.replaceAll(' ', '_')
  if (h.taxid && taxonomyInfo?.has(h.taxid)) {
    const info = taxonomyInfo.get(h.taxid)!
    if (info.commonName) {
      speciesName = info.commonName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('_')
    }
  }
  return `${h.accession}-${speciesName}`
}

export function strip(s: string) {
  return s.replace('-', '')
}
