function hostOf(url: string) {
  try {
    return new URL(url).host
  } catch {
    // a relative url, e.g. a same-origin proxy path
    return url
  }
}

export async function handleFetch(url: string, args?: RequestInit) {
  let response: Response
  try {
    response = await fetch(url, args)
  } catch (e) {
    // fetch rejects with a bare "TypeError: Failed to fetch" for every network
    // level failure, including a cross-origin response the browser refused to
    // hand over. That is not a hypothetical: NCBI's Blast.cgi stopped sending
    // Access-Control-Allow-Origin to third-party origins, and the raw TypeError
    // told users nothing at all about why. See docs/blast.md.
    if (e instanceof TypeError) {
      throw new Error(
        `Could not reach ${hostOf(url)} — the request failed at the network level. This is usually a CORS restriction (the server refused to let this site read the response), an offline connection, or a blocked request.`,
        { cause: e },
      )
    }
    throw e
  }

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
