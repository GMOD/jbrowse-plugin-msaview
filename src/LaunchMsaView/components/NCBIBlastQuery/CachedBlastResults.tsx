import React, { useMemo, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
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
import { useCachedBlastResults } from './useCachedBlastResults'
import { getGeneIdentifiers } from '../../util'

import type { CachedBlastResult } from '../../../utils/blastCache'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  const view = getContainingView(model) as LinearGenomeViewModel
  const [operationError, setOperationError] = useState<unknown>()

  const geneIds = useMemo(() => getGeneIdentifiers(feature), [feature])

  const { results, error, isLoading, handleDelete, handleClearAll } =
    useCachedBlastResults(geneIds)

  const handleUseCached = (cached: CachedBlastResult) => {
    blastLaunchViewFromCache({
      view,
      cached,
      newViewTitle: `BLAST - ${getResultDisplayName(cached)}`,
    })
    handleClose()
  }

  const displayError = error ?? operationError
  if (displayError) {
    return <ErrorMessage error={displayError} />
  }

  if (isLoading) {
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
          onClick={async () => {
            try {
              setOperationError(undefined)
              await handleClearAll()
            } catch (e) {
              setOperationError(e)
            }
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
                onClick={async e => {
                  e.stopPropagation()
                  try {
                    setOperationError(undefined)
                    await handleDelete(result.id)
                  } catch (err) {
                    setOperationError(err)
                  }
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
