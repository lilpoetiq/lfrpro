'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Circle, Plus, MessageSquare } from 'lucide-react'
import ReleaseChecklist from '@/components/ReleaseChecklist'

interface CatalogItem {
  id: string
  song: string
  artist: string
  artistId?: string
  artistIds?: string[]
  releaseType?: 'single' | 'ep' | 'album'
  albumCover?: string
  fileUrl?: string
  songs?: Array<{
    id: string
    song: string
    audioUrl?: string
    streams?: number
    isrc?: string
  }>
}

export default function SongChecklistPage() {
  const params = useParams()
  const router = useRouter()
  const songId = params.songId as string
  
  const [song, setSong] = useState<CatalogItem | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [songId])

  const fetchData = async () => {
    try {
      const [catalogRes, tasksRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch(`/api/tasks?songId=${songId}`),
      ])

      const catalogData = await catalogRes.json()
      const tasksData = await tasksRes.json()

      if (catalogData.success) {
        const foundSong = catalogData.catalog.find((s: CatalogItem) => s.id === songId)
        setSong(foundSong || null)
      }

      if (tasksData.success) {
        setTasks(tasksData.tasks)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="space-y-8">
        <button
          onClick={() => router.push('/dashboard/catalog')}
          className="flex items-center text-slate-400 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Catalog
        </button>
        <div className="text-center py-12">
          <p className="text-slate-400">Song not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() => router.push(`/dashboard/catalog/${songId}`)}
          className="flex items-center text-slate-400 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Song
        </button>
        <h1 className="text-3xl font-bold text-white mb-2">Release Checklist</h1>
        <p className="text-slate-400">{song.song} by {song.artist}</p>
      </div>

      {song && <ReleaseChecklist songId={songId} songName={song.song} song={song} />}
    </div>
  )
}

