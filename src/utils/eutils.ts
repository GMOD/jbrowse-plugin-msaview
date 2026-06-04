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
