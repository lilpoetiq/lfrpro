/**
 * Shows where DATA_DIR and UPLOAD_DIR resolve.
 * Loads `.env.local` if present (minimal parser) so paths match the app.
 * Run: npm run paths
 */
import fs from 'fs'
import path from 'path'

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  const text = fs.readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const line_ = line.replace(/\r$/, '')
    const trimmed = line_.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (key && (process.env as Record<string, string>)[key] === undefined) {
      process.env[key] = val
    }
  }
}

async function main() {
  loadEnvLocal()
  const { DATA_BASE, UPLOAD_BASE, getDataPath, getUploadPath } = await import('../lib/uploadConfig')

  console.log('Resolved storage (lib/uploadConfig):')
  console.log('  DATA_DIR / DATA_BASE: ', path.resolve(DATA_BASE))
  console.log('  UPLOAD_DIR / UPLOAD_BASE:', path.resolve(UPLOAD_BASE))
  console.log('')
  console.log('Examples:')
  console.log('  catalog.json      →', getDataPath('catalog.json'))
  console.log('  album-covers/     →', getUploadPath('album-covers'))
  console.log('  track-audio/      →', getUploadPath('track-audio'))
  console.log('  beats/            →', getUploadPath('beats'))
  console.log('  data/backups/     →', getDataPath('backups'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
