import React, { useEffect, useMemo, useState } from 'react'

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

import type { CachedBlastResult } from '../../../utils/blastCache'
import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function getGeneIdentifiers(feature: Feature): string[] {
  const ids = [
    feature.id(),
    feature.get('id'),
    feature.get('name'),
    feature.get('gene_id'),
    feature.get('gene_name'),
  ].filter((id): id is string => !!id)
  return [...new Set(ids)]
}

function getResultDisplayName(result: CachedBlastResult): string {
  const parts = []
  if (result.geneName) {
    parts.push(result.geneName)
  }
  if (result.transcriptName && result.transcriptName !== result.geneName) {
    parts.push(result.transcriptName)
  }
  if (parts.length === 0) {
    parts.push(result.geneId ?? result.transcriptId ?? 'Unknown')
  }
  return parts.join(' - ')
}

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

  const geneIds = useMemo(() => getGeneIdentifiers(feature), [feature])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const cached = await getAllCachedResults()
        setResults(cached.filter(r => r.geneId && geneIds.includes(r.geneId)))
        setLoading(false)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [geneIds])

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
      newViewTitle: `BLAST - ${getResultDisplayName(cached)}`,
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Typography variant="subtitle1">
          Cached BLAST Results ({results.length})
        </Typography>
        <Button
          size="small"
          color="error"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            handleClearAll()
          }}
        >
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
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
                primary={`${getResultDisplayName(result)} - ${result.blastDatabase}/${result.blastProgram} (${result.msaAlgorithm})`}
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
