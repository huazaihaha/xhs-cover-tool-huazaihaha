import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function resolveAppDataDir() {
  const raw = (process.env.APP_DATA_DIR || '').trim()
  if (!raw) return path.resolve(__dirname, '../data')
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
}

