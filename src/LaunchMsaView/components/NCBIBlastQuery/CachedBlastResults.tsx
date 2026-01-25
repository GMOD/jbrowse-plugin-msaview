import React, { useEffect, useState } from 'react'

import { Feature, getContainingView } from '@jbrowse/core/util'
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
import {
  clearAllCachedResults,
  deleteCachedResult,
  getAllCachedResults,
} from '../../../utils/blastCache'

import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { CachedBlastResult } from '../../../utils/blastCache'

const CachedBlastResults = observer(function ({
  model,
  handleClose,
  feature,
}: {
  model: AbstractTrackModel
  handleClose: () => void
  feature: Feature
}) {
  const [results, setResults] = useState<CachedBlastResult[]>([])
  const [loading, setLoading] = useState(true)
  const view = getContainingView(model) as LinearGenomeViewModel

  const geneId = feature.get('id')
  useEffect(() => {
    let cancelled = false
    getAllCachedResults().then(cached => {
      if (!cancelled) {
        setResults(cached.filter(r => r.geneId === geneId))
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [geneId])

  const handleDelete = async (id: string) => {
    await deleteCachedResult(id)
    setResults(r => r.filter(result => result.id !== id))
  }

  const handleClearAll = async () => {
    await clearAllCachedResults()
    setResults([])
  }

  const handleUseCached = (cached: CachedBlastResult) => {
    blastLaunchViewFromCache({
      view,
      cached,
      newViewTitle: `BLAST - ${cached.geneId ?? cached.transcriptId ?? 'Unknown gene'}`,
    })
    handleClose()
  }

  if (loading) {
    return <Typography>Loading cached results...</Typography>
  }

  if (results.length === 0) {
    return (
      <Typography color="textSecondary">
        No cached BLAST results found for this gene. Run a BLAST query to cache
        results.
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
                primary={`${result.geneId ?? result.transcriptId ?? 'Unknown'} - ${result.blastDatabase}/${result.blastProgram} (${result.msaAlgorithm})`}
                secondary={`${new Date(result.timestamp).toLocaleString()} - Seq: ${result.proteinSequence.slice(0, 30)}...`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  )
})

export default CachedBlastResults
