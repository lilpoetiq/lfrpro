/**
 * Local health check: data paths, JSON catalog/users, common gaps.
 * Run: npx tsx scripts/diagnose.ts
 */
import { existsSync } from 'fs'
import path from 'path'
import { getCatalog, getUsers } from '../lib/storage'
import { getDataPath, UPLOAD_BASE } from '../lib/uploadConfig'

function main() {
  const dataDir = getDataPath()
  const catalog = getCatalog()
  const users = getUsers()
  const userIds = new Set(users.map((u) => u.id))

  let noId = 0
  let noArtistLink = 0
  let orphaned = 0
  const missingLinkSamples: { id?: string; song: string; artist: string }[] = []

  for (const item of catalog) {
    if (!item.id) noId++
    if (!item.artistId && (!item.artistIds || item.artistIds.length === 0)) {
      noArtistLink++
      if (missingLinkSamples.length < 20) {
        missingLinkSamples.push({ id: item.id, song: item.song, artist: item.artist })
      }
    }
    if (item.artistId && !userIds.has(item.artistId)) orphaned++
  }

  const report = {
    dataDir,
    uploadBase: UPLOAD_BASE,
    dataDirExists: existsSync(dataDir),
    uploadBaseExists: existsSync(UPLOAD_BASE),
    catalogDb: path.join(dataDir, 'catalog.db'),
    catalogDbExists: existsSync(path.join(dataDir, 'catalog.db')),
    catalogItems: catalog.length,
    users: users.length,
    catalogMissingId: noId,
    catalogMissingArtistLink: noArtistLink,
    catalogMissingArtistLinkSamples: missingLinkSamples,
    orphanedArtistIdRefs: orphaned,
    archivedCount: catalog.filter((i) => i.isArchived).length,
    deniedCount: catalog.filter((i) => i.releaseApprovalStatus === 'denied').length,
    adminUsernames: users.filter((u) => u.role === 'admin').map((u) => u.username),
  }

  console.log(JSON.stringify(report, null, 2))

  if (noArtistLink > 0) {
    console.error(
      `\nNote: ${noArtistLink} catalog row(s) have no artistId/artistIds — artist logins may not see them until linked (e.g. GET /api/catalog?autoLink=true as admin or fix in data).`
    )
  }
  if (orphaned > 0) {
    console.error(`\nWarning: ${orphaned} catalog row(s) reference a missing user id.`)
  }
}

main()
