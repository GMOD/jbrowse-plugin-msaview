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
  await pollLoop({
    intervalSeconds,
    onCountdown,
    check: async () => {
      // exact match, not includes(): a job whose status is ERROR must not be
      // able to poll forever waiting for a FINISHED that will never arrive
      const status = (
        await textfetch(`${EBI_BASE}/${tool}/status/${jobId}`)
      ).trim()
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
