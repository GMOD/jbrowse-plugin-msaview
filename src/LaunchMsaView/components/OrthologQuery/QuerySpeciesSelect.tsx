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
  const [typed, setTyped] = useState<string>()

  // Opening on `human` for everyone is the same silent wrong answer the fixed
  // species list gave: on a mouse assembly the gene symbol resolves to the HUMAN
  // gene, and the excluded taxon is human too, so mouse appears twice. The
  // assembly being browsed is the one thing here that already knows the answer.
  // An assembly NCBI does not index leaves the default, so this can only improve
  // on guessing.
  const { data: assemblySpecies } = useFetch(
    assemblyName ? [assemblyName, 'assembly-species'] : null,
    () => resolveAssemblySpecies(assemblyName!),
  )

  // derived, not seeded through an effect: whatever the user typed wins, and
  // until they type anything the assembly's species does, so a lookup that
  // lands while they are mid-word cannot overwrite the field
  const text = typed ?? assemblySpecies?.speciesName ?? 'human'
  const debounced = useDebounced(text, 400)

  const { data: taxon, error } = useFetch(
    debounced.trim() ? [debounced.trim(), 'taxon'] : null,
    () => describeTaxon(debounced),
    {
      onSuccess: ({ taxId }) => {
        onChange(taxId)
      },
    },
  )

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
          : (taxon?.label ?? `the species this gene is from (taxon ${value})`)
      }
    />
  )
}
