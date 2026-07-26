import 'dotenv/config'

import { loadWorkerEnvironment } from '@cross-border/shared'

import { createWorkerStatus } from './worker-status'

const environment = loadWorkerEnvironment(process.env)
const status = createWorkerStatus(environment.WORKER_NAME)

process.stdout.write(`${JSON.stringify(status)}\n`)
