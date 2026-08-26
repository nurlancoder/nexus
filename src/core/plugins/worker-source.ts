/**
 * Single source of truth for the plugin sandbox JS lives at
 * `public/plugin-worker.js`. This module reads it at import time so there
 * is only one file to maintain. The standalone file is also served directly
 * by Vite for the production browser Worker.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const WORKER_SOURCE: string = readFileSync(
  join(__dirname, '..', '..', '..', 'public', 'plugin-worker.js'),
  'utf-8',
)
