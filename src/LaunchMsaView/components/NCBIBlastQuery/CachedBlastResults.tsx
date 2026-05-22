import React, { useMemo, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
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
import { makeStyles } from 'tss-react/mui'

import { blastLaunchViewFromCache } from './blastLaunchView'
import { useCachedBlastResults } from './useCachedBlastResults'
import { getGeneIdentifiers, getLinearGenomeView } from '../../util'

import type { CachedBlastResult } from '../../../utils/blastCache'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultList: {
    maxHeight: 300,
    overflow: 'auto',
  },
})

function getResultDisplayName(result: CachedBlastResult): string {
  const parts = [
    result.geneName,
    result.transcriptName !== result.geneName
      ? result.transcriptName
      : undefined,
  ].filter((p): p is string => !!p)
  return parts.length > 0
    ? parts.join(' - ')
    : (result.geneId ?? result.transcriptId ?? 'Unknown')
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
  const { classes } = useStyles()
  const view = getLinearGenomeView(model)
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
  return displayError ? (
    <ErrorMessage error={displayError} />
  ) : isLoading ? (
    <Typography>Loading cached results...</Typography>
  ) : results.length === 0 ? (
    <Typography color="textSecondary">
      No cached BLAST results found for this gene. Run a BLAST query to cache
      results.
    </Typography>
  ) : (
    <div>
      <div className={classes.header}>
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
      <List dense className={classes.resultList}>
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
