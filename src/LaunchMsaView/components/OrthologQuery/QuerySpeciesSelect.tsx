import React, { useState } from 'react'

import { observer } from 'mobx-react'

import TextField2 from '../../../components/TextField2'
import {
  resolveAssemblySpecies,
  resolveTaxId,
} from '../../../utils/ncbiTaxonomy'
import { fetchTaxonomyInfo } from '../../../utils/taxonomyNames'
import { useDebounced, useFetch } from '../../../utils/useFetch'

async function describeTaxon(query: string, signal: AbortSignal) {
  const taxId = await resolveTaxId(query, signal)
  if (!taxId) {
    throw new Error(`No NCBI taxon matches "${query}"`)
  }
  const failures: unknown[] = []
  const info = (
    await fetchTaxonomyInfo([taxId], signal, e => {
      failures.push(e)
    })
  ).get(taxId)
  // a throttle would otherwise read as a taxon NCBI has no name for
  if (!info && failures.length > 0) {
    throw new Error(`NCBI did not answer for the name of taxon ${taxId}`, {
      cause: failures[0],
    })
  }
  const label = [info?.sciname, info?.commonName && `(${info.commonName})`]
    .filter(Boolean)
    .join(' ')
  return { taxId, label: label || `taxon ${taxId}` }
}

const defaultTaxId = 9606

/**
 * The species the query gene came from, as free text resolved against NCBI's
 * taxonomy rather than picked from a fixed list.
 *
 * The resolved taxon is shown back as helper text, which is the whole point of
 * resolving on a debounce instead of on submit: a typo resolves to some other
 * organism rather than to nothing, and the only place that surfaces is the gene
 * lookup, as "could not resolve NLRP1 in taxon 9986".
 */
export function useQuerySpecies(assemblyName?: string) {
  // undefined until the user types, which is what makes the two lookups
  // exclusive rather than both firing on open
  const [typed, setTyped] = useState<string>()
  const debounced = useDebounced(typed, 400)

  // Opening on `human` for everyone is the same silent wrong answer the fixed
  // species list gave: on a mouse assembly the gene symbol resolves to the HUMAN
  // gene, and the excluded taxon is human too, so mouse appears twice. The
  // assembly being browsed is the one thing here that already knows the answer.
  //
  // db=assembly already returns the taxon id, so this is the whole lookup — the
  // taxonomy chain below would be two more requests for an answer we hold. That
  // is not just waste: eutils allows 3 requests a second and throttles by
  // answering without CORS headers, so all four fired on open and the browser
  // reported the throttle as "blocked by CORS policy" in the helper text.
  const fromAssembly = useFetch(
    assemblyName && typed === undefined
      ? [assemblyName, 'assembly-species']
      : null,
    signal => resolveAssemblySpecies(assemblyName!, signal),
  )

  const fromText = useFetch(
    debounced?.trim() ? [debounced.trim(), 'taxon'] : null,
    signal => describeTaxon(debounced!, signal),
  )

  const taxId =
    typed === undefined
      ? fromAssembly.isLoading
        ? undefined
        : (fromAssembly.data?.taxId ?? defaultTaxId)
      : typed === debounced
        ? fromText.data?.taxId
        : undefined

  return {
    taxId,
    resolving:
      typed === undefined
        ? fromAssembly.isLoading
        : typed !== debounced || fromText.isLoading,
    // derived, not seeded through an effect: whatever the user typed wins, and
    // until they type anything the assembly's species does, so a lookup that
    // lands while they are mid-word cannot overwrite the field
    text: typed ?? fromAssembly.data?.speciesName ?? 'human',
    resolved:
      typed === undefined
        ? fromAssembly.data?.speciesName
        : fromText.data?.label,
    error: fromText.error,
    setTyped,
  }
}

const QuerySpeciesSelect = observer(function QuerySpeciesSelect({
  species: { taxId, text, resolved, error, setTyped },
  className,
}: {
  species: ReturnType<typeof useQuerySpecies>
  className?: string
}) {
  return (
    <TextField2
      variant="outlined"
      label="Query species"
      className={className}
      value={text}
      onChange={event => {
        setTyped(event.target.value)
      }}
      error={!!error}
      helperText={
        error
          ? `${error}`
          : (resolved ??
            (taxId === undefined
              ? 'the species this gene is from'
              : `the species this gene is from (taxon ${taxId})`))
      }
    />
  )
})

export default QuerySpeciesSelect
