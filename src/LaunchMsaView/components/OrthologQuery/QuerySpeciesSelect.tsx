import React, { useEffect, useState } from 'react'

import TextField2 from '../../../components/TextField2'
import { resolveTaxId } from '../../../utils/ncbiTaxonomy'
import { fetchTaxonomyInfo } from '../../../utils/taxonomyNames'

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
  const [resolved, setResolved] = useState<string>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // read through a call rather than as a property: the cleanup writes it from
    // another turn of the loop, and a bare `run.live` narrows to true after the
    // first check, which reads to the compiler as a redundant second one
    const run = { live: true }
    const cancelled = () => !run.live
    async function lookup() {
      try {
        setError(undefined)
        const taxId = await resolveTaxId(text)
        if (cancelled()) {
          return
        }
        if (!taxId) {
          setResolved(undefined)
          setError(new Error(`No NCBI taxon matches "${text}"`))
          return
        }
        const info = (await fetchTaxonomyInfo([taxId])).get(taxId)
        if (cancelled()) {
          return
        }
        setResolved(
          [info?.sciname, info?.commonName && `(${info.commonName})`]
            .filter(Boolean)
            .join(' ') || `taxon ${taxId}`,
        )
        onChange(taxId)
      } catch (e) {
        if (!cancelled()) {
          setError(e)
        }
      }
    }
    const timer = setTimeout(() => {
      void lookup()
    }, 400)
    return () => {
      run.live = false
      clearTimeout(timer)
    }
    // onChange is a setState updater from the parent and stable in practice;
    // including it would re-run the lookup on every parent render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

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
          : (resolved ?? `the species this gene is from (taxon ${value})`)
      }
    />
  )
}
