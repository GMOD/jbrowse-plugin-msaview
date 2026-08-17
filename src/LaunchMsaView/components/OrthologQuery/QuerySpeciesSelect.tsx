import React, { useState } from 'react'

import TextField2 from '../../../components/TextField2'
import {
  resolveAssemblySpecies,
  resolveTaxId,
} from '../../../utils/ncbiTaxonomy'
import { fetchTaxonomyInfo } from '../../../utils/taxonomyNames'
import { useDebounced, useFetch } from '../../../utils/useFetch'

async function describeTaxon(query: string) {
  const taxId = await resolveTaxId(query)
  if (!taxId) {
    throw new Error(`No NCBI taxon matches "${query}"`)
  }
  const info = (await fetchTaxonomyInfo([taxId])).get(taxId)
  const label = [info?.sciname, info?.commonName && `(${info.commonName})`]
    .filter(Boolean)
    .join(' ')
  return { taxId, label: label || `taxon ${taxId}` }
}

/**
 * The species the query gene came from, as free text resolved against NCBI's
 * taxonomy rather than picked from a fixed list.
 *
 * The resolved taxon is shown back as helper text, which is the whole point of
 * resolving on a debounce instead of on submit: a typo resolves to some other
 * organism rather than to nothing, and the only place that surfaces is the gene
 * lookup, as "could not resolve NLRP1 in taxon 9986".
 */
export default function QuerySpeciesSelect({
  value,
  assemblyName,
  onChange,
  className,
}: {
  value: number
  assemblyName?: string
  onChange: (taxId: number) => void
  className?: string
}) {
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
  const { data: fromAssembly } = useFetch(
    assemblyName && typed === undefined
      ? [assemblyName, 'assembly-species']
      : null,
    () => resolveAssemblySpecies(assemblyName!),
    {
      onSuccess: found => {
        if (found) {
          onChange(found.taxId)
        }
      },
    },
  )

  const { data: fromText, error } = useFetch(
    debounced?.trim() ? [debounced.trim(), 'taxon'] : null,
    () => describeTaxon(debounced!),
    {
      onSuccess: ({ taxId }) => {
        onChange(taxId)
      },
    },
  )

  // derived, not seeded through an effect: whatever the user typed wins, and
  // until they type anything the assembly's species does, so a lookup that
  // lands while they are mid-word cannot overwrite the field
  const text = typed ?? fromAssembly?.speciesName ?? 'human'
  const resolved =
    typed === undefined ? fromAssembly?.speciesName : fromText?.label

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
          : (resolved ?? `the species this gene is from (taxon ${value})`)
      }
    />
  )
}
