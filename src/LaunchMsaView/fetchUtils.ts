export async function myfetch(url: string, args?: RequestInit) {
  const response = await fetch(url, args)

  if (!response.ok) {
    throw new Error(`BLAST API request failed with status ${response.status}`)
  }

  return response
}

export async function textfetch(url: string, args?: RequestInit) {
  const response = await myfetch(url, args)
  return response.text()
}

export async function jsonfetch(url: string, args?: RequestInit) {
  const response = await myfetch(url, args)
  return response.json()
}

export function timeout(time: number) {
  return new Promise(res => setTimeout(res, time))
}