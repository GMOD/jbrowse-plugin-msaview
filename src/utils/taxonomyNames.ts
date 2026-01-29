import { openDB } from 'idb'

const DB_NAME = 'jbrowse-msaview-taxonomy-cache'
const STORE_NAME = 'common-names'
const DB_VERSION = 2

interface CachedTaxonomy {
  taxid: number
  sciname: string
  commonName?: string
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'taxid' })
    },
  })
}

async function getCachedCommonName(taxid: number) {
  const db = await getDB()
  return db.get(STORE_NAME, taxid) as Promise<CachedTaxonomy | undefined>
}

async function saveTaxonomyCache(entries: CachedTaxonomy[]) {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  for (const entry of entries) {
    await tx.store.put(entry)
  }
  await tx.done
}

export interface TaxonomyInfo {
  sciname: string
  commonName?: string
}

export async function fetchTaxonomyInfo(
  taxids: number[],
): Promise<Map<number, TaxonomyInfo>> {
  const result = new Map<number, TaxonomyInfo>()
  const uncachedTaxids: number[] = []

  for (const taxid of taxids) {
    const cached = await getCachedCommonName(taxid)
    if (cached) {
      result.set(taxid, {
        sciname: cached.sciname,
        commonName: cached.commonName,
      })
    } else {
      uncachedTaxids.push(taxid)
    }
  }

  if (uncachedTaxids.length === 0) {
    return result
  }

  const batchSize = 100
  const toCache: CachedTaxonomy[] = []

  for (let i = 0; i < uncachedTaxids.length; i += batchSize) {
    const batch = uncachedTaxids.slice(i, i + batchSize)
    const idsParam = batch.join(',')

    try {
      const response = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=taxonomy&id=${idsParam}&retmode=xml`,
      )
      const text = await response.text()

      // Build a map of taxid -> taxon block by finding Taxon elements.
      // Prefer entries with <LineageEx> (full top-level entries) over nested
      // entries inside another taxon's LineageEx
      const taxonMap = new Map<number, string>()
      const taxonRegex = /<Taxon>\s*<TaxId>(\d+)<\/TaxId>/g
      let match
      while ((match = taxonRegex.exec(text)) !== null) {
        const matchedTaxid = Number(match[1])
        const startIdx = match.index

        // Find the matching closing </Taxon> by counting nesting depth
        let depth = 1
        let endIdx = startIdx + match[0].length
        while (depth > 0 && endIdx < text.length) {
          const openMatch = text.indexOf('<Taxon>', endIdx)
          const closeMatch = text.indexOf('</Taxon>', endIdx)
          if (closeMatch === -1) {
            break
          }
          if (openMatch !== -1 && openMatch < closeMatch) {
            depth++
            endIdx = openMatch + 7
          } else {
            depth--
            endIdx = closeMatch + 8
          }
        }

        const taxonXml = text.slice(startIdx, endIdx)
        const existing = taxonMap.get(matchedTaxid)
        const hasLineageEx = taxonXml.includes('<LineageEx>')
        const existingHasLineageEx = existing?.includes('<LineageEx>')
        if (!existing || (hasLineageEx && !existingHasLineageEx)) {
          taxonMap.set(matchedTaxid, taxonXml)
        }
      }

      for (const taxid of batch) {
        const taxonXml = taxonMap.get(taxid)
        if (taxonXml) {
          const genbankCommon =
            /<GenbankCommonName>(.*?)<\/GenbankCommonName>/.exec(taxonXml)
          const commonName = /<CommonName>(.*?)<\/CommonName>/.exec(taxonXml)
          const sciName = /<ScientificName>(.*?)<\/ScientificName>/.exec(
            taxonXml,
          )
          const name = genbankCommon?.[1] ?? commonName?.[1]

          const sci = sciName?.[1] ?? ''
          result.set(taxid, { sciname: sci, commonName: name })
          toCache.push({ taxid, sciname: sci, commonName: name })
        } else {
          toCache.push({ taxid, sciname: '', commonName: undefined })
        }
      }
    } catch (error) {
      console.error('Failed to fetch taxonomy data:', error)
    }
  }

  if (toCache.length > 0) {
    await saveTaxonomyCache(toCache)
  }

  return result
}
