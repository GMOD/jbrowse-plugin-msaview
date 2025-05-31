import { ungzip } from 'pako'

export async function myfetch(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${await res.text()}`)
  }
  const data = await res.arrayBuffer()
  return new TextDecoder().decode(ungzip(data))
}
