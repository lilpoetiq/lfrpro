/**
 * Readiness Data Hook
 * Fetches readiness state, explanation, and action steps with session caching
 */

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface ReadinessData {
  readiness: {
    id: string
    artistId: string
    state: 'cooling' | 'building' | 'ready'
    lastUpdated: string
  } | null
  explanation: {
    id: string
    artistId: string
    explanationText: string
    actionSteps: string[]
    generatedAt: string
  } | null
  calculated: {
    calculatedState: string
    momentum: string
    momentumData: {
      direction: string
      baseline: number
      recent: number
      changePercent: number
      confidence: number
    }
    lane: string
    weightedScore: number
  } | null
  isLoading: boolean
  error: string | null
}

// Session cache
const cache = new Map<string, { data: ReadinessData; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useReadinessData(artistId?: string, options?: { refetch?: boolean }) {
  const { user } = useAuth()
  const [data, setData] = useState<ReadinessData>({
    readiness: null,
    explanation: null,
    calculated: null,
    isLoading: true,
    error: null,
  })
  const abortControllerRef = useRef<AbortController | null>(null)

  const targetArtistId = artistId || user?.id

  useEffect(() => {
    if (!targetArtistId) {
      setData(prev => ({ ...prev, isLoading: false }))
      return
    }

    // Check cache
    const cacheKey = `readiness_${targetArtistId}`
    const cached = cache.get(cacheKey)
    const now = Date.now()

    if (!options?.refetch && cached && (now - cached.timestamp) < CACHE_DURATION) {
      setData({ ...cached.data, isLoading: false })
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    const fetchData = async () => {
      setData(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        const res = await fetch(
          `/api/release-readiness?artistId=${targetArtistId}&type=all&recalculate=true`,
          { signal: abortControllerRef.current!.signal }
        )

        if (!res.ok) {
          throw new Error(`Failed to fetch readiness data: ${res.statusText}`)
        }

        const result = await res.json()

        if (result.success) {
          const readinessData: ReadinessData = {
            readiness: result.data.readiness,
            explanation: result.data.explanations && result.data.explanations.length > 0
              ? result.data.explanations[result.data.explanations.length - 1]
              : null,
            calculated: result.data.readiness?.calculated || null,
            isLoading: false,
            error: null,
          }

          // Update cache
          cache.set(cacheKey, { data: readinessData, timestamp: now })

          setData(readinessData)
        } else {
          throw new Error(result.error || 'Failed to fetch readiness data')
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return // Request was cancelled
        }

        console.error('[useReadinessData] Error:', error)
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Failed to fetch readiness data',
        }))
      }
    }

    fetchData()

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [targetArtistId, options?.refetch])

  // Clear cache function
  const clearCache = () => {
    if (targetArtistId) {
      cache.delete(`readiness_${targetArtistId}`)
    }
  }

  // Refetch function
  const refetch = () => {
    clearCache()
    setData(prev => ({ ...prev, isLoading: true }))
    // Trigger refetch via options
    return fetch(
      `/api/release-readiness?artistId=${targetArtistId}&type=all&recalculate=true`
    )
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          const readinessData: ReadinessData = {
            readiness: result.data.readiness,
            explanation: result.data.explanations && result.data.explanations.length > 0
              ? result.data.explanations[result.data.explanations.length - 1]
              : null,
            calculated: result.data.readiness?.calculated || null,
            isLoading: false,
            error: null,
          }
          cache.set(`readiness_${targetArtistId}`, { data: readinessData, timestamp: Date.now() })
          setData(readinessData)
        }
      })
  }

  return {
    ...data,
    refetch,
    clearCache,
  }
}
