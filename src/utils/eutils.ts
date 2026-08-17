// NCBI asks that programmatic E-utilities requests identify themselves with a
// tool name and contact email so they can reach out before throttling, rather
// than silently rate-limiting. https://www.ncbi.nlm.nih.gov/books/NBK25497/
export const NCBI_TOOL = 'jbrowse-plugin-msaview'
export const NCBI_EMAIL = 'colin.diesh@gmail.com'

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export function efetchUrl(params: Record<string, string>) {
  const search = new URLSearchParams({
    ...params,
    tool: NCBI_TOOL,
    email: NCBI_EMAIL,
  })
  return `${EUTILS}/efetch.fcgi?${search.toString()}`
}

/**
 * The same request as a POST body. An `id` list of a few hundred accessions
 * exceeds what a URL carries — 865 of them is ~13KB — and NCBI documents POST
 * as the route above about 200 ids. eutils sends `ACAO: *` on both verbs.
 */
export function efetchPost(params: Record<string, string>) {
  return [
    `${EUTILS}/efetch.fcgi`,
    {
      method: 'POST',
      body: new URLSearchParams({
        ...params,
        tool: NCBI_TOOL,
        email: NCBI_EMAIL,
      }),
    },
  ] as const
}
