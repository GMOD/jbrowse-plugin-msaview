import { isAbortError, textfetch } from './fetch'
import { pollLoop } from './poll'
import { readLocalStorage } from './useLocalStorage'

/**
 * EBI's Job Dispatcher REST services (clustalo, muscle, ncbiblast, ...) all
 * speak the same run/status/result protocol, so the transport lives here and
 * each tool only supplies its own parameters and result types.
 *
 * Unlike NCBI's Blast.cgi these endpoints send `Access-Control-Allow-Origin: *`,
 * which is why the BLAST backend moved here — see docs/blast.md.
 */
export const EBI_BASE = 'https://www.ebi.ac.uk/Tools/services/rest'

/**
 * EBI asks for a contact address on every submission so they can reach whoever
 * is generating the load. A deployment that sends real volume should point this
 * at its own maintainer via the BLAST settings dialog — otherwise every
 * msaview job in the world is attributed to one person.
 */
export const EBI_EMAIL_STORAGE_KEY = 'msa-ebiContactEmail'
export const DEFAULT_EBI_EMAIL = 'colin.diesh@gmail.com'

export function getEbiEmail() {
  const configured = readLocalStorage(
    EBI_EMAIL_STORAGE_KEY,
    DEFAULT_EBI_EMAIL,
  ).trim()
  return configured || DEFAULT_EBI_EMAIL
}

/** Statuses that mean the job is over and produced no result. */
const FAILED_STATUSES = new Set(['ERROR', 'FAILURE', 'NOT_FOUND'])

async function submitEbiJob({
  tool,
  params,
  signal,
}: {
  tool: string
  params: Record<string, string>
  signal?: AbortSignal
}) {
  const jobId = await textfetch(`${EBI_BASE}/${tool}/run`, {
    method: 'POST',
    body: new URLSearchParams({ email: getEbiEmail(), ...params }),
    signal,
  })
  return jobId.trim()
}

/**
 * A status check that could not reach EBI at all says nothing about the job, so
 * it is not a reason to abandon one. A job the server has accepted keeps running
 * whatever happens to the poller's connection, and EBI's cluster has answered
 * status checks with a 502 for ten minutes on jobs that then finished (see
 * docs/blast.md).
 *
 * So the poll gives up only once checks have failed without a break for this
 * long: an endpoint that has genuinely gone away must not be polled forever.
 */
export const STATUS_FAILURE_BUDGET_MS = 15 * 60 * 1000

export async function waitForEbiJob({
  tool,
  jobId,
  intervalSeconds = 10,
  onCountdown,
  signal,
}: {
  tool: string
  jobId: string
  intervalSeconds?: number
  onCountdown: (secondsRemaining: number) => void
  signal?: AbortSignal
}) {
  let failingSince: number | undefined
  await pollLoop({
    intervalSeconds,
    onCountdown,
    signal,
    check: async () => {
      let status: string
      try {
        status = (
          await textfetch(`${EBI_BASE}/${tool}/status/${jobId}`, { signal })
        ).trim()
      } catch (e) {
        // a cancelled request is the caller giving up, not EBI being
        // unreachable, so it must end the poll rather than be retried
        if (isAbortError(e)) {
          throw e
        }
        failingSince ??= Date.now()
        if (Date.now() - failingSince >= STATUS_FAILURE_BUDGET_MS) {
          throw new Error(
            `Could not reach EBI to check ${tool} job ${jobId} for ${Math.round(STATUS_FAILURE_BUDGET_MS / 60_000)} minutes`,
            { cause: e },
          )
        }
        console.warn('[msaview] EBI status check failed, retrying:', e)
        return false
      }
      failingSince = undefined
      // exact match, not includes(): a job whose status is ERROR must not be
      // able to poll forever waiting for a FINISHED that will never arrive
      if (status === 'FINISHED') {
        return true
      }
      if (FAILED_STATUSES.has(status)) {
        throw new Error(`EBI ${tool} job ${jobId} returned status ${status}`)
      }
      // RUNNING, QUEUED, PENDING and anything else EBI adds later
      return false
    },
  })
}

/**
 * One job from submission to result: submit, publish the job id, poll until
 * it finishes, then hand back a reader for its result files. `label` names the
 * job in the progress text.
 */
export async function runEbiJob({
  tool,
  label,
  params,
  onProgress,
  onRid,
  signal,
}: {
  tool: string
  label: string
  params: Record<string, string>
  onProgress: (arg: string) => void
  onRid?: (jobId: string) => void
  signal?: AbortSignal
}) {
  onProgress(`Submitting ${label} to EBI...`)
  const jobId = await submitEbiJob({ tool, params, signal })
  onRid?.(jobId)
  await waitForEbiJob({
    tool,
    jobId,
    signal,
    onCountdown: s => {
      onProgress(`Re-checking ${label} status in... ${s}`)
    },
  })
  return {
    jobId,
    result: (type: string) =>
      textfetch(`${EBI_BASE}/${tool}/result/${jobId}/${type}`, { signal }),
  }
}
