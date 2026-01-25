import { openDB } from 'idb'

const DB_NAME = 'jbrowse-msaview-taxonomy-cache'
const STORE_NAME = 'common-names'
const DB_VERSION = 1

interface CachedTaxonomy {
  taxid: number
  sciname: string
  commonName?: string
  timestamp: number
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'taxid' })
      }
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
    tx.store.put(entry)
  }
  await tx.done
}

export async function fetchCommonNames(
  taxids: number[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  const uncachedTaxids: number[] = []

  for (const taxid of taxids) {
    const cached = await getCachedCommonName(taxid)
    if (cached?.commonName) {
      result.set(taxid, cached.commonName)
    } else if (cached === undefined) {
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

      for (const taxid of batch) {
        const taxonRegex = new RegExp(
          `<Taxon>.*?<TaxId>${taxid}</TaxId>.*?</Taxon>`,
          's',
        )
        const taxonMatch = taxonRegex.exec(text)

        if (taxonMatch) {
          const taxonXml = taxonMatch[0]
          const genbankCommon = /<GenbankCommonName>(.*?)<\/GenbankCommonName>/.exec(taxonXml)
          const commonName = /<CommonName>(.*?)<\/CommonName>/.exec(taxonXml)
          const sciName = /<ScientificName>(.*?)<\/ScientificName>/.exec(taxonXml)

          const name = genbankCommon?.[1] ?? commonName?.[1]

          if (name) {
            result.set(taxid, name)
          }

          toCache.push({
            taxid,
            sciname: sciName?.[1] ?? '',
            commonName: name,
            timestamp: Date.now(),
          })
        } else {
          toCache.push({
            taxid,
            sciname: '',
            commonName: undefined,
            timestamp: Date.now(),
          })
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

export function formatSpeciesName(
  sciname: string,
  commonName?: string,
): string {
  if (commonName) {
    return commonName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('_')
  }
  return sciname.replaceAll(' ', '_')
}
