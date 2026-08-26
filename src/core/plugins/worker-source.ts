/**
 * Single source of truth for the plugin sandbox JS lives at
 * `public/plugin-worker.js`. Vite's `?raw` import inlines the file
 * as a string at build time — no Node.js runtime APIs needed.
 * The standalone file is also served directly by Vite for the
 * production browser Worker.
 */
import WORKER_SOURCE from '../../../public/plugin-worker.js?raw'

export { WORKER_SOURCE }
