export async function fetchGeneList() {
  const res = await fetch(
    'https://jbrowse.org/demos/msaview/knownCanonical/list.txt',
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching list ${await res.text()}`)
  }
  const result = await res.text()
  return result
    .split('\n')
    .map(f => f.trim())
    .filter(f => !!f)
}
