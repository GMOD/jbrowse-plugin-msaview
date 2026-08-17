import { textfetch } from './fetch'
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

export async function submitEbiJob({
  tool,
  params,
}: {
  tool: string
  params: Record<string, string>
}) {
  const jobId = await textfetch(`${EBI_BASE}/${tool}/run`, {
    method: 'POST',
    body: new URLSearchParams({ email: getEbiEmail(), ...params }),
  })
  return jobId.trim()
}

/**
 * A status check that could not reach EBI at all says nothing about the job, so
 * it is not a reason to abandon one. A job the server has accepted keeps running
 * whatever happens to the poller's connection, and the poll is the long part: an
 * alignment of a hundred sequences runs for minutes and is checked every ten
 * seconds, so a single blip anywhere in that window used to throw away a job
 * that went on to finish.
 *
 * Consecutive failures still end it, because an endpoint that has genuinely gone
 * away must not be polled forever.
 */
const MAX_CONSECUTIVE_STATUS_FAILURES = 5

export async function waitForEbiJob({
  tool,
  jobId,
  intervalSeconds = 10,
  onCountdown,
}: {
  tool: string
  jobId: string
  intervalSeconds?: number
  onCountdown: (secondsRemaining: number) => void
}) {
  let consecutiveFailures = 0
  await pollLoop({
    intervalSeconds,
    onCountdown,
    check: async () => {
      let status: string
      try {
        status = (await textfetch(`${EBI_BASE}/${tool}/status/${jobId}`)).trim()
      } catch (e) {
        consecutiveFailures += 1
        if (consecutiveFailures >= MAX_CONSECUTIVE_STATUS_FAILURES) {
          throw new Error(
            `Could not reach EBI to check ${tool} job ${jobId} after ${consecutiveFailures} tries`,
            { cause: e },
          )
        }
        console.warn(
          `[msaview] EBI status check ${consecutiveFailures} failed, retrying:`,
          e,
        )
        return false
      }
      consecutiveFailures = 0
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

export async function fetchEbiResult({
  tool,
  jobId,
  type,
}: {
  tool: string
  jobId: string
  type: string
}) {
  return textfetch(`${EBI_BASE}/${tool}/result/${jobId}/${type}`)
}
