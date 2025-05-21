import { ungzip } from 'pako'

export async function jsonfetch<T>(url: string, arg?: RequestInit) {
  const res = await fetch(url, arg)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

export async function textfetch(url: string, arg?: RequestInit) {
  const res = await fetch(url, arg)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`)
  }
  return res.text()
}

export async function fetchWithLocalStorageCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cachedData = localStorage.getItem(key)

  if (cachedData) {
    try {
      return JSON.parse(cachedData) as T
    } catch (error) {
      console.error(`Error parsing cached data for ${key}:`, error)
      // Continue to fetch fresh data if parsing fails
    }
  }

  const data = await fetchFn()
  localStorage.setItem(key, JSON.stringify(data))
  return data
}

export async function unzipfetch(url: string, arg?: RequestInit) {
  const res = await fetch(url, arg)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`)
  }
  return ungzip(await res.arrayBuffer(), { to: 'string' })
}
