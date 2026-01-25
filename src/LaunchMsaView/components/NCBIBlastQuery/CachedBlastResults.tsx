import React, { useEffect, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { blastLaunchViewFromCache } from './blastLaunchView'

import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { CachedBlastResult } from '../../../utils/blastCache'

const CachedBlastResults = observer(function ({
  model,
  handleClose,
  onSelect,
}: {
  model: AbstractTrackModel
  handleClose: () => void
  onSelect?: (cached: CachedBlastResult) => void
}) {
  const [results, setResults] = useState<CachedBlastResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loadResults = async () => {
      const { getAllCachedResults } = await import('../../../utils/blastCache')
      const cached = await getAllCachedResults()
      if (!cancelled) {
        setResults(cached)
        setLoading(false)
      }
    }
    loadResults()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDelete = async (id: string) => {
    const { deleteCachedResult } = await import('../../../utils/blastCache')
    await deleteCachedResult(id)
    setResults(r => r.filter(result => result.id !== id))
  }

  const handleClearAll = async () => {
    const { clearAllCachedResults } = await import('../../../utils/blastCache')
    await clearAllCachedResults()
    setResults([])
  }

  const view = getContainingView(model) as LinearGenomeViewModel

  const handleUseCached = (cached: CachedBlastResult) => {
    if (onSelect) {
      onSelect(cached)
    } else {
      blastLaunchViewFromCache({
        view,
        cached,
        newViewTitle: `BLAST (cached) - ${cached.geneId ?? 'Unknown gene'}`,
      })
      handleClose()
    }
  }

  if (loading) {
    return <Typography>Loading cached results...</Typography>
  }

  if (results.length === 0) {
    return (
      <Typography color="textSecondary">
        No cached BLAST results found. Run a BLAST query to cache results.
      </Typography>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography variant="subtitle1">
          Cached BLAST Results ({results.length})
        </Typography>
        <Button size="small" color="error" onClick={handleClearAll}>
          Clear All
        </Button>
      </div>
      <List dense style={{ maxHeight: 300, overflow: 'auto' }}>
        {results.map(result => (
          <ListItem
            key={result.id}
            disablePadding
            secondaryAction={
              <IconButton
                edge="end"
                size="small"
                onClick={e => {
                  e.stopPropagation()
                  handleDelete(result.id)
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemButton
              onClick={() => {
                handleUseCached(result)
              }}
            >
              <ListItemText
                primary={`${result.geneId ?? result.transcriptId ?? 'Unknown'} - ${result.blastDatabase}/${result.blastProgram}`}
                secondary={`${result.hits.length} hits - ${new Date(result.timestamp).toLocaleString()} - Seq: ${result.proteinSequence.slice(0, 30)}...`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  )
})

export default CachedBlastResults
