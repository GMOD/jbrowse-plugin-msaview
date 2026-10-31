import { installContractGate } from '@jbrowse/display-kit/conformance/contractGate'
import { afterAll, afterEach } from 'vitest'

installContractGate({ afterEach, afterAll })
