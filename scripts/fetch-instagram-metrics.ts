#!/usr/bin/env ts-node

/**
 * Instagram Metrics Fetch Script
 * 
 * Fetches Instagram metrics for all connected artists and stores them in the database.
 * This script should be run daily via cron job.
 * 
 * Usage:
 *   npm run fetch-instagram-metrics
 *   or
 *   npx tsx scripts/fetch-instagram-metrics.ts
 * 
 * Cron example (runs daily at 2 AM):
 *   0 2 * * * cd /path/to/lfr-dashboard && npm run fetch-instagram-metrics
 */

import { getUsers, getInstagramMetrics, addInstagramMetrics, upsertReleaseReadiness } from '../lib/storage'
import { fetchInstagramMetrics } from '../lib/metaApi'
import { calculateReadinessState } from '../lib/readinessEngine'

async function fetchAllInstagramMetrics() {
  console.log('[Instagram Metrics] Starting fetch job...')
  
  const users = getUsers()
  const artists = users.filter(
    u => u.role === 'artist' && u.instagramAccountId && u.instagramAccessToken
  )

  if (artists.length === 0) {
    console.log('[Instagram Metrics] No artists with Instagram accounts connected')
    return
  }

  console.log(`[Instagram Metrics] Found ${artists.length} artist(s) with Instagram accounts`)

  const results = {
    successful: 0,
    skipped: 0,
    errors: 0,
  }

  for (const artist of artists) {
    if (!artist.instagramAccountId || !artist.instagramAccessToken) {
      continue
    }

    // Check if token is expired
    if (artist.instagramTokenExpiresAt) {
      const expiresAt = new Date(artist.instagramTokenExpiresAt)
      if (expiresAt < new Date()) {
        console.warn(
          `[Instagram Metrics] Token expired for artist ${artist.artistName || artist.name} (${artist.id})`
        )
        results.errors++
        continue
      }
    }

    try {
      // Check if we already have metrics for today
      const today = new Date().toISOString().split('T')[0]
      const existingMetrics = getInstagramMetrics(artist.id)
      const todayMetrics = existingMetrics.find(m => m.metricDate.startsWith(today))

      if (todayMetrics) {
        console.log(
          `[Instagram Metrics] Skipping ${artist.artistName || artist.name} - metrics already exist for today`
        )
        results.skipped++
        continue
      }

      // Fetch metrics from Meta API
      console.log(`[Instagram Metrics] Fetching metrics for ${artist.artistName || artist.name}...`)
      const metrics = await fetchInstagramMetrics(
        artist.instagramAccountId,
        artist.instagramAccessToken
      )

      // Save metrics to database
      addInstagramMetrics({
        artistId: artist.id,
        metricDate: today,
        views: metrics.views,
        saves: metrics.saves,
        shares: metrics.shares,
        comments: metrics.comments,
        completionRate: metrics.completionRate / 100, // Store as decimal (0-1)
        followers: metrics.followers,
      })

      // Recalculate readiness state after adding new metrics
      try {
        const updatedMetrics = getInstagramMetrics(artist.id)
        if (updatedMetrics.length > 0) {
          const readinessCalc = calculateReadinessState(updatedMetrics, artist)
          upsertReleaseReadiness({
            artistId: artist.id,
            state: readinessCalc.state,
          })
          console.log(
            `[Instagram Metrics] ✓ Updated readiness state: ${readinessCalc.state} (${readinessCalc.momentum} momentum)`
          )
        }
      } catch (readinessError: any) {
        console.warn(`[Instagram Metrics] Failed to calculate readiness:`, readinessError.message)
        // Don't fail the whole operation if readiness calculation fails
      }

      console.log(
        `[Instagram Metrics] ✓ Successfully saved metrics for ${artist.artistName || artist.name}:`,
        {
          views: metrics.views,
          saves: metrics.saves,
          shares: metrics.shares,
          comments: metrics.comments,
          completionRate: `${metrics.completionRate.toFixed(1)}%`,
          followers: metrics.followers,
        }
      )

      results.successful++
    } catch (error: any) {
      console.error(
        `[Instagram Metrics] ✗ Error fetching metrics for ${artist.artistName || artist.name}:`,
        error.message
      )
      results.errors++
    }
  }

  console.log('[Instagram Metrics] Fetch job completed:', results)
}

// Run the script
fetchAllInstagramMetrics()
  .then(() => {
    console.log('[Instagram Metrics] Script finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Instagram Metrics] Script failed:', error)
    process.exit(1)
  })
