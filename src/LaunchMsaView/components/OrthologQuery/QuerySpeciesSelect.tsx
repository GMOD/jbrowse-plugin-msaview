import React, { useState } from 'react'

import TextField2 from '../../../components/TextField2'
import { resolveTaxId } from '../../../utils/ncbiTaxonomy'
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
  onChange,
  className,
}: {
  value: number
  onChange: (taxId: number) => void
  className?: string
}) {
  const [text, setText] = useState('human')
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
        setText(event.target.value)
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
