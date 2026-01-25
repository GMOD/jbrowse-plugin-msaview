export function makeId(
  h: { accession: string; sciname: string; taxid?: number },
  commonNames?: Map<number, string>,
) {
  let speciesName = h.sciname.replaceAll(' ', '_')
  if (h.taxid && commonNames?.has(h.taxid)) {
    const common = commonNames.get(h.taxid)!
    speciesName = common
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('_')
  }
  return `${h.accession}-${speciesName}`
}

export function strip(s: string) {
  return s.replace('-', '')
}
