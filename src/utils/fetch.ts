import { ungzip } from 'pako'

export async function handleFetch(url: string, args?: RequestInit) {
  const response = await fetch(url, args)

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} fetching ${url} ${await response.text()}`,
    )
  }

  return response
}

export async function textfetch(url: string, args?: RequestInit) {
  const response = await handleFetch(url, args)
  return response.text()
}

export async function jsonfetch<T>(url: string, args?: RequestInit) {
  const response = await handleFetch(url, args)
  return response.json() as Promise<T>
}

export function timeout(time: number) {
  return new Promise(res => setTimeout(res, time))
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
      localStorage.removeItem(key)
    }
  }

  const data = await fetchFn()
  localStorage.setItem(key, JSON.stringify(data))
  return data
}

export async function unzipfetch(url: string, arg?: RequestInit) {
  const res = await handleFetch(url, arg)
  return ungzip(await res.arrayBuffer(), { to: 'string' })
}