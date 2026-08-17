import { NCBI_EMAIL, NCBI_TOOL } from './eutils'
import { jsonfetch } from './fetch'

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

/**
 * Free text -> NCBI taxon id. A bare number is taken as the id itself; anything
 * else is searched against db=taxonomy, which resolves a scientific name
 * (`Danio rerio`), a common name (`zebrafish`) and a genus alike.
 *
 * This replaces a fixed list of species the dialog used to offer. The query
 * taxon has to match the assembly the user is browsing -- `resolveGeneId`
 * searches `SYMBOL[Gene Name] AND <taxid>[taxid]` -- so a list that stops at 23
 * species silently resolves the wrong organism's gene for anyone outside it.
 */
export async function resolveTaxId(query: string) {
  const term = query.trim()
  if (!term) {
    return undefined
  }
  if (/^\d+$/.test(term)) {
    return Number(term)
  }
  const search = new URLSearchParams({
    db: 'taxonomy',
    term,
    retmode: 'json',
    retmax: '1',
    tool: NCBI_TOOL,
    email: NCBI_EMAIL,
  })
  const json = await jsonfetch<{ esearchresult?: { idlist?: string[] } }>(
    `${EUTILS}/esearch.fcgi?${search.toString()}`,
  )
  const id = json.esearchresult?.idlist?.[0]
  return id ? Number(id) : undefined
}
