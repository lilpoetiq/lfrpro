'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Music, FileText, Upload, Plus, Trash2, Link as LinkIcon, Search, Play, Pause, Download, Folder, FolderPlus, ChevronRight, ChevronLeft, Video, Copy, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import ProgressBar from '@/components/ProgressBar'
import Link from 'next/link'

interface SongVaultFile {
  id: string
  songId?: string
  songName?: string
  artistName?: string
  artistId?: string
  fileName: string
  fileType: 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other' | 'folder'
  fileUrl?: string
  googleDriveUrl?: string
  link?: string // External link
  fileSize?: number
  folderPath?: string
  isFolder?: boolean
  children?: string[]
  uploadedAt: string
  uploadedBy: string
  isUnreleased?: boolean
}

interface CatalogItem {
  id: string
  song: string
  artist: string
}

// Helper function to convert Google Drive URLs to playable format
const convertGoogleDriveUrl = (url: string): string => {
  if (!url) return url
  
  // Check if it's a Google Drive URL
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveMatch) {
    const fileId = driveMatch[1]
    // Convert to direct stream URL for audio/video playback
    return `https://drive.google.com/uc?export=open&id=${fileId}`
  }
  
  // Check if it's already a uc?export URL
  if (url.includes('drive.google.com/uc')) {
    return url
  }
  
  // Return original URL if not Google Drive
  return url
}

// Helper function to get playable URL for audio/video files
const getPlayableUrl = (file: SongVaultFile): string | null => {
  if (!file) return null
  
  // Priority: fileUrl > googleDriveUrl > link
  if (file.fileUrl) {
    // If it's a local file URL, ensure it's properly formatted
    if (file.fileUrl.startsWith('/api/files/')) {
      return file.fileUrl
    }
    // If it's a relative path, make it absolute
    if (file.fileUrl.startsWith('/')) {
      return file.fileUrl
    }
    return file.fileUrl
  }
  
  if (file.googleDriveUrl) {
    return convertGoogleDriveUrl(file.googleDriveUrl)
  }
  
  if (file.link) {
    // Check if it's a Google Drive link
    if (file.link.includes('drive.google.com')) {
      return convertGoogleDriveUrl(file.link)
    }
    return file.link
  }
  
  return null
}

type VaultTab = 'songs' | 'beats' | 'videos'

export default function VaultPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<VaultTab>('songs')
  const [vaultFiles, setVaultFiles] = useState<SongVaultFile[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [vaultView, setVaultView] = useState<'regular' | 'unreleased'>('regular')
  const [fileFormData, setFileFormData] = useState({
    songId: '',
    songName: '', // For unreleased songs
    artistName: '', // For unreleased songs
    artistId: '', // For unreleased songs
    fileName: '',
    fileType: 'logic' as 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other',
    file: null as File | null,
    files: null as FileList | null, // For folder uploads
    folderPath: '', // Folder path for organization
    isFolderUpload: false, // Whether uploading a folder
    isUnreleased: false, // Whether this is an unreleased song
    link: '', // External link
  })
  const [users, setUsers] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [playingFile, setPlayingFile] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string>('') // Current folder path being viewed
  const [downloadingFolders, setDownloadingFolders] = useState<Set<string>>(new Set()) // Track folders being downloaded
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set()) // Track files being downloaded
  const [audioError, setAudioError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    fetchData()
    fetchUsers()
  }, [])

  // Handle audio/video playback when playingFile changes
  useEffect(() => {
    if (playingFile && audioRef.current) {
      // Small delay to ensure element is mounted
      const timer = setTimeout(() => {
        if (audioRef.current && audioRef.current.paused) {
          audioRef.current.play().catch((err) => {
            console.error('Failed to auto-play audio:', err)
            // Browser may block autoplay - user can use controls
          })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
    if (playingFile && videoRef.current) {
      const timer = setTimeout(() => {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch((err) => {
            console.error('Failed to auto-play video:', err)
          })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [playingFile])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.users.filter((u: any) => u.role === 'artist'))
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchData = async () => {
    try {
      const [vaultRes, catalogRes] = await Promise.all([
        fetch('/api/song-vault'),
        fetch('/api/catalog'),
      ])

      const vaultData = await vaultRes.json()
      const catalogData = await catalogRes.json()

      if (vaultData.success) {
        // Enrich vault files with song/artist names
        const files = vaultData.files.map((file: SongVaultFile) => {
          // If it's an unreleased song, use its own songName/artistName
          if (file.isUnreleased && file.songName && file.artistName) {
            return file
          }
          // Otherwise, try to find in catalog
          const song = catalogData.success && file.songId
            ? catalogData.catalog.find((s: CatalogItem) => s.id === file.songId)
            : null
          return {
            ...file,
            songName: file.songName || song?.song || 'Unknown Song',
            artistName: file.artistName || song?.artist || 'Unknown Artist',
          }
        })
        // Sort vault files by date (oldest to newest)
        const sortedFiles = files.sort((a: SongVaultFile, b: SongVaultFile) => {
          const dateA = new Date(a.uploadedAt || 0).getTime()
          const dateB = new Date(b.uploadedAt || 0).getTime()
          return dateA - dateB // Oldest first
        })
        setVaultFiles(sortedFiles)
      }

      if (catalogData.success) {
        setCatalog(catalogData.catalog)
      }
    } catch (error) {
      console.error('Failed to fetch vault data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if it's a folder upload
    if (fileFormData.isFolderUpload && fileFormData.files) {
      await handleFolderUpload(fileFormData.files)
      return
    }
    
    if (!fileFormData.file) {
      alert('Please select a file or folder to upload')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    
    // Estimate time based on file size (roughly 1MB per second)
    const estimatedTime = Math.max(3, Math.ceil((fileFormData.file.size / (1024 * 1024)) * 1.5)) // seconds
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(90, prev + 5))
    }, estimatedTime * 50)

    if (!user?.id) {
      alert('User ID is required. Please log in again.')
      return
    }

    try {
      // First upload the file
      const uploadFormData = new FormData()
      uploadFormData.append('file', fileFormData.file)
      uploadFormData.append('category', 'vault')
      uploadFormData.append('userId', user.id)
      if (fileFormData.folderPath) {
        uploadFormData.append('folderPath', fileFormData.folderPath)
      }

      const uploadRes = await fetch('/api/upload-file', {
        method: 'POST',
        body: uploadFormData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const uploadData = await uploadRes.json()
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'File upload failed')
      }

      // Then add to vault
      const res = await fetch('/api/song-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songId: fileFormData.songId,
            fileName: fileFormData.fileName || fileFormData.file.name,
            fileType: fileFormData.fileType,
            fileUrl: uploadData.fileUrl,
            fileSize: uploadData.size,
            folderPath: fileFormData.folderPath || undefined,
            uploadedBy: user?.name || 'Admin',
            link: fileFormData.link || undefined,
            isUnreleased: fileFormData.isUnreleased,
            songName: fileFormData.isUnreleased ? fileFormData.songName : undefined,
            artistName: fileFormData.isUnreleased ? fileFormData.artistName : undefined,
            artistId: fileFormData.isUnreleased ? fileFormData.artistId : undefined,
          }),
      })

      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setFileFormData({ songId: '', songName: '', artistName: '', artistId: '', fileName: '', fileType: 'logic', file: null, files: null, folderPath: '', isFolderUpload: false, isUnreleased: false, link: '' })
        fetchData()
      }
    } catch (error: any) {
      console.error('Failed to add file:', error)
      alert(error.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleFolderUpload = async (files: FileList) => {
    setIsUploading(true)
    setUploadProgress(0)
    
    const fileArray = Array.from(files)
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0)
    const estimatedTime = Math.max(5, Math.ceil((totalSize / (1024 * 1024)) * 1.5)) // seconds
    
    try {
      let uploadedCount = 0
      const errors: string[] = []
      
      // Get the folder name from the first file's webkitRelativePath
      const firstFile = fileArray[0]
      const folderName = firstFile.webkitRelativePath.split('/')[0]
      const baseFolderPath = fileFormData.folderPath 
        ? `${fileFormData.folderPath}/${folderName}`
        : folderName

      for (const file of fileArray) {
        try {
          // Extract relative path from webkitRelativePath
          const relativePath = file.webkitRelativePath.substring(folderName.length + 1)
          const fileFolderPath = relativePath.includes('/')
            ? `${baseFolderPath}/${relativePath.substring(0, relativePath.lastIndexOf('/'))}`
            : baseFolderPath

          // Upload file
          const uploadFormData = new FormData()
          uploadFormData.append('file', file)
          uploadFormData.append('category', 'vault')
          uploadFormData.append('userId', user?.id || '')
          uploadFormData.append('folderPath', fileFolderPath)

          const uploadRes = await fetch('/api/upload-file', {
            method: 'POST',
            body: uploadFormData,
          })

          const uploadData = await uploadRes.json()
          if (!uploadData.success) {
            throw new Error(uploadData.error || 'File upload failed')
          }

          // Determine file type from extension
          const extension = file.name.split('.').pop()?.toLowerCase()
          let fileType: 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other' = 'other'
          if (extension === 'logicx' || extension === 'logic') {
            fileType = 'logic'
          } else if (['wav', 'aiff', 'mp3', 'm4a'].includes(extension || '')) {
            fileType = 'bounced'
          }

          // Add to vault
          const res = await fetch('/api/song-vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              songId: fileFormData.songId || 'general',
              fileName: file.name,
              fileType: fileType,
              fileUrl: uploadData.fileUrl,
              fileSize: uploadData.size,
              folderPath: fileFolderPath,
              uploadedBy: user?.name || 'Admin',
              userId: user?.id,
              link: fileFormData.link || undefined,
              isUnreleased: fileFormData.isUnreleased,
              songName: fileFormData.isUnreleased ? fileFormData.songName : undefined,
              artistName: fileFormData.isUnreleased ? fileFormData.artistName : undefined,
              artistId: fileFormData.isUnreleased ? fileFormData.artistId : undefined,
            }),
          })

          const data = await res.json()
          if (data.success) {
            uploadedCount++
            setUploadProgress(Math.floor((uploadedCount / fileArray.length) * 100))
          } else {
            errors.push(`${file.name}: ${data.error || 'Failed to add to vault'}`)
          }
        } catch (error: any) {
          errors.push(`${file.name}: ${error.message || 'Upload failed'}`)
        }
      }

      if (uploadedCount > 0) {
        alert(`Successfully uploaded ${uploadedCount} file${uploadedCount !== 1 ? 's' : ''}${errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : ''}`)
        setShowAddModal(false)
        setFileFormData({ songId: '', songName: '', artistName: '', artistId: '', fileName: '', fileType: 'logic', file: null, files: null, folderPath: '', isFolderUpload: false, isUnreleased: false, link: '' })
        fetchData()
      } else {
        alert(`Failed to upload files:\n${errors.join('\n')}`)
      }
    } catch (error: any) {
      console.error('Failed to upload folder:', error)
      alert(error.message || 'Failed to upload folder')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const res = await fetch(`/api/song-vault?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }


  // Get unique folders from files
  const getFolders = () => {
    const folders = new Set<string>()
    const filesToCheck = vaultView === 'unreleased' 
      ? vaultFiles.filter(f => f.isUnreleased)
      : vaultFiles.filter(f => !f.isUnreleased)
    filesToCheck.forEach(file => {
      if (file.folderPath) {
        const parts = file.folderPath.split('/')
        for (let i = 0; i < parts.length; i++) {
          const folderPath = parts.slice(0, i + 1).join('/')
          folders.add(folderPath)
        }
      }
    })
    return Array.from(folders).sort()
  }

  // Filter files by current folder
  const getFilesInCurrentFolder = () => {
    return vaultFiles.filter((file) => {
      // Skip folder entries themselves
      if (file.isFolder) return false
      
      // Filter by vault view (regular vs unreleased)
      if (vaultView === 'unreleased' && !file.isUnreleased) return false
      if (vaultView === 'regular' && file.isUnreleased) return false
      
      // Filter by folder
      const fileFolder = file.folderPath || ''
      let matchesFolder = false
      
      if (currentFolder === '') {
        // Show files in root (no folder path or empty folder path)
        matchesFolder = !file.folderPath || file.folderPath === ''
      } else {
        // Show files that are directly in the current folder (not in subfolders)
        // File folder should match exactly or be a direct child
        const relativePath = fileFolder.startsWith(currentFolder + '/')
          ? fileFolder.substring(currentFolder.length + 1)
          : fileFolder === currentFolder ? '' : null
        
        // Only show files directly in this folder (not in subfolders)
        matchesFolder = relativePath !== null && !relativePath.includes('/')
      }
      
      // Filter by search
      const matchesSearch =
        file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.songName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.artistName?.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Filter by type
      const matchesFilter = filterType === 'all' || file.fileType === filterType
      
      return matchesFolder && matchesSearch && matchesFilter
    })
  }

  const filteredFiles = getFilesInCurrentFolder()
  
  // Get folders in current directory
  const foldersInCurrentDir = getFolders().filter(folder => {
    if (currentFolder === '') {
      return !folder.includes('/')
    }
    const relativePath = folder.startsWith(currentFolder + '/') 
      ? folder.substring(currentFolder.length + 1)
      : null
    return relativePath && !relativePath.includes('/')
  })

  const fileTypeCounts = vaultFiles.reduce((acc, file) => {
    acc[file.fileType] = (acc[file.fileType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Vault</h1>
          <p className="text-slate-400">
            Songs, beats, and videos — all in one place
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(['songs', 'beats', 'videos'] as VaultTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === tab
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab === 'songs' && <span className="flex items-center gap-2"><Music className="w-4 h-4" /> Song Vault</span>}
            {tab === 'beats' && <span className="flex items-center gap-2"><Music className="w-4 h-4" /> Beat Vault</span>}
            {tab === 'videos' && <span className="flex items-center gap-2"><Video className="w-4 h-4" /> Video Vault</span>}
          </button>
        ))}
      </div>

      {/* Beats tab */}
      {activeTab === 'beats' && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-8 border border-slate-800 text-center">
          <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Beat Vault</h2>
          <p className="text-slate-400 mb-4">Browse and manage beats, packs, and producers</p>
          <Link
            href="/dashboard/beats"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Open Beat Catalog
          </Link>
        </div>
      )}

      {/* Video vault tab */}
      {activeTab === 'videos' && (
        <VideoVaultTab user={user} />
      )}

      {/* Song vault tab */}
      {activeTab === 'songs' && (
        <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {vaultView === 'unreleased' ? 'Unreleased Vault' : 'Song Vault'}
          </h2>
          <p className="text-slate-400 text-sm">
            {vaultView === 'unreleased' 
              ? 'Unreleased songs not yet in catalog' 
              : 'Manage session files, stems, masters, and production assets'}
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => {
              setFileFormData({ songId: '', songName: '', artistName: '', artistId: '', fileName: '', fileType: 'logic', file: null, files: null, folderPath: currentFolder, isFolderUpload: false, isUnreleased: false, link: '' })
              setShowAddModal(true)
            }}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>Add File / Folder</span>
          </button>
        )}
      </div>

      {/* Vault View Toggle */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-4 border border-slate-800 shadow-lg mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-slate-300">Vault View:</span>
          <button
            onClick={() => {
              setVaultView('regular')
              setCurrentFolder('')
            }}
            className={`px-4 py-2 rounded-lg transition ${
              vaultView === 'regular'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Regular Vault
          </button>
          <button
            onClick={() => {
              setVaultView('unreleased')
              setCurrentFolder('')
            }}
            className={`px-4 py-2 rounded-lg transition ${
              vaultView === 'unreleased'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Unreleased Vault
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {vaultView === 'regular' 
              ? vaultFiles.filter(f => !f.isUnreleased).length
              : vaultFiles.filter(f => f.isUnreleased).length}
          </h3>
          <p className="text-sm text-slate-400">
            {vaultView === 'regular' ? 'Regular Files' : 'Unreleased Songs'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Music className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {vaultView === 'regular'
              ? new Set(vaultFiles.filter(f => !f.isUnreleased && f.songId).map(f => f.songId)).size
              : new Set(vaultFiles.filter(f => f.isUnreleased).map(f => `${f.songName}-${f.artistName}`)).size}
          </h3>
          <p className="text-sm text-slate-400">
            {vaultView === 'regular' ? 'Songs with Files' : 'Unreleased Songs'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {fileTypeCounts['logic'] || 0}
          </h3>
          <p className="text-sm text-slate-400">Logic Projects</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {fileTypeCounts['master'] || 0}
          </h3>
          <p className="text-sm text-slate-400">Masters</p>
        </div>
      </div>

      {/* Folder Navigation */}
      {currentFolder && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-4 border border-slate-800 shadow-lg">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => setCurrentFolder('')}
              className="text-slate-400 hover:text-white transition"
            >
              Home
            </button>
            {currentFolder.split('/').map((part, idx, arr) => {
              const folderPath = arr.slice(0, idx + 1).join('/')
              return (
                <div key={idx} className="flex items-center space-x-2">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                  <button
                    onClick={() => setCurrentFolder(folderPath)}
                    className="text-slate-400 hover:text-white transition"
                  >
                    {part}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by song, artist, or filename..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Types</option>
            <option value="logic">Logic Projects</option>
            <option value="bounced">Bounced Versions</option>
            <option value="stem">Stems</option>
            <option value="master">Masters</option>
            <option value="music_video">Music Videos</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Folders List */}
        {foldersInCurrentDir.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Folders</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {foldersInCurrentDir.map((folderPath) => {
                const folderName = folderPath.split('/').pop() || folderPath
                const filesInFolder = vaultFiles.filter(f => 
                  f.folderPath && (f.folderPath === folderPath || f.folderPath.startsWith(folderPath + '/'))
                )
                return (
                  <div
                    key={folderPath}
                    className={`flex items-center space-x-2 p-4 bg-slate-800/50 rounded-lg border transition relative ${
                      downloadingFolders.has(folderPath)
                        ? 'border-red-500/50 bg-red-500/10 animate-pulse'
                        : 'border-slate-700 hover:bg-slate-800/70'
                    }`}
                  >
                    {downloadingFolders.has(folderPath) && (
                      <div className="absolute inset-0 bg-red-500/5 rounded-lg animate-pulse" />
                    )}
                    <button
                      onClick={() => setCurrentFolder(folderPath)}
                      className="flex items-center space-x-3 flex-1 text-left"
                    >
                      <div className="p-2 bg-yellow-500/20 rounded-lg">
                        <Folder className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold truncate">{folderName}</h4>
                        <p className="text-xs text-slate-400">{filesInFolder.length} file{filesInFolder.length !== 1 ? 's' : ''}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        setDownloadingFolders(prev => new Set(prev).add(folderPath))
                        try {
                          const res = await fetch(`/api/download-folder?folderPath=${encodeURIComponent(folderPath)}`)
                          if (!res.ok) {
                            const error = await res.json()
                            throw new Error(error.error || 'Failed to download folder')
                          }
                          
                          // Get the blob and create download link
                          const blob = await res.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${folderName}.zip`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (error: any) {
                          console.error('Failed to download folder:', error)
                          alert(error.message || 'Failed to download folder')
                        } finally {
                          setDownloadingFolders(prev => {
                            const next = new Set(prev)
                            next.delete(folderPath)
                            return next
                          })
                        }
                      }}
                      disabled={downloadingFolders.has(folderPath)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed relative"
                      title="Download Folder as ZIP"
                    >
                      {downloadingFolders.has(folderPath) ? (
                        <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Files List */}
        {filteredFiles.length === 0 && foldersInCurrentDir.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {vaultView === 'unreleased' 
                ? 'No unreleased songs in vault' 
                : 'No vault files found'}
            </p>
            {vaultView === 'unreleased' && (
              <p className="text-sm text-slate-500 mt-2">
                Add unreleased songs by selecting "Unreleased Song" when uploading files
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">File</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Song / Artist</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Link</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-800/50 transition ${
                        downloadingFiles.has(file.id) ? 'bg-red-500/10 animate-pulse' : ''
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate max-w-[200px]" title={file.fileName}>
                              {file.fileName}
                            </div>
                            {file.folderPath && (
                              <div className="text-xs text-yellow-400 truncate max-w-[200px]" title={file.folderPath}>
                                📁 {file.folderPath}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-sm text-slate-300 truncate max-w-[200px]" title={`${file.songName} - ${file.artistName}`}>
                          {file.songName} - {file.artistName}
                        </div>
                        {file.isUnreleased && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded mt-1 inline-block">
                            UNRELEASED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded capitalize">
                          {file.fileType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {file.fileSize ? (
                          <span className="text-xs text-slate-400">
                            {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-2">
                          {file.link && (
                            <a
                              href={file.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                              title={file.link}
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">Link</span>
                            </a>
                          )}
                          {file.googleDriveUrl && (
                            <a
                              href={file.googleDriveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-400 hover:text-green-300 flex items-center space-x-1"
                              title="Google Drive"
                            >
                              <LinkIcon className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          {!file.link && !file.googleDriveUrl && (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs text-slate-400">
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Play/Pause button for audio/video files */}
                          {(file.fileType === 'bounced' || file.fileType === 'master' || file.fileType === 'music_video') && (file.fileUrl || file.googleDriveUrl || file.link) && (
                            <button
                              onClick={async () => {
                                if (playingFile === file.id) {
                                  // Pause current playback
                                  if (audioRef.current) {
                                    audioRef.current.pause()
                                  }
                                  if (videoRef.current) {
                                    videoRef.current.pause()
                                  }
                                  setPlayingFile(null)
                                } else {
                                  // Stop any currently playing file
                                  if (audioRef.current) {
                                    audioRef.current.pause()
                                    audioRef.current.currentTime = 0
                                  }
                                  if (videoRef.current) {
                                    videoRef.current.pause()
                                    videoRef.current.currentTime = 0
                                  }
                                  // Set new playing file
                                  setPlayingFile(file.id)
                                  // Play will be triggered by useEffect when audio/video element loads
                                }
                              }}
                              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition"
                              title={playingFile === file.id ? 'Stop' : 'Play'}
                            >
                              {playingFile === file.id ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {(file.fileUrl || file.googleDriveUrl || file.link) && (
                            <button
                              onClick={async () => {
                                if (file.googleDriveUrl) {
                                  window.open(file.googleDriveUrl, '_blank')
                                  return
                                }
                                
                                if (file.link) {
                                  window.open(file.link, '_blank')
                                  return
                                }
                                
                                if (!file.fileUrl) {
                                  alert('File URL not available')
                                  return
                                }
                                
                                setDownloadingFiles(prev => new Set(prev).add(file.id))
                                try {
                                  const response = await fetch(file.fileUrl!, { method: 'GET' })
                                  
                                  if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({ error: response.statusText }))
                                    throw new Error(errorData.error || `Failed to download: ${response.status}`)
                                  }
                                  
                                  const blob = await response.blob()
                                  const url = window.URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = file.fileName
                                  a.style.display = 'none'
                                  document.body.appendChild(a)
                                  a.click()
                                  
                                  setTimeout(() => {
                                    window.URL.revokeObjectURL(url)
                                    document.body.removeChild(a)
                                  }, 100)
                                } catch (error: any) {
                                  console.error('Download error:', error)
                                  alert(`Download failed: ${error.message || 'Unknown error'}`)
                                } finally {
                                  setDownloadingFiles(prev => {
                                    const next = new Set(prev)
                                    next.delete(file.id)
                                    return next
                                  })
                                }
                              }}
                              disabled={downloadingFiles.has(file.id)}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition disabled:opacity-50"
                              title="Download / Open"
                            >
                              {downloadingFiles.has(file.id) ? (
                                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {file.isUnreleased ? (
                            <button
                              onClick={async () => {
                                if (!confirm(`Transfer "${file.songName}" by ${file.artistName} to catalog?`)) return
                                
                                try {
                                  const res = await fetch('/api/transfer-vault-to-catalog', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      vaultFileId: file.id,
                                      releaseType: 'single',
                                    }),
                                  })
                                  
                                  const data = await res.json()
                                  if (data.success) {
                                    alert(`Successfully transferred "${file.songName}" to catalog!`)
                                    fetchData()
                                  } else {
                                    alert(data.error || 'Failed to transfer to catalog')
                                  }
                                } catch (error: any) {
                                  console.error('Transfer error:', error)
                                  alert('Failed to transfer to catalog')
                                }
                              }}
                              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition"
                              title="Transfer to Catalog"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          ) : file.songId ? (
                            <a
                              href={`/dashboard/catalog/${file.songId}`}
                              className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                              title="View Song"
                            >
                              <Music className="w-4 h-4" />
                            </a>
                          ) : null}
                          {(user?.role === 'admin' || user?.role === 'manager') && (
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                              title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredFiles.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                No files found
              </div>
            )}
          </div>
        )}
        
        {/* Audio/Video Player */}
        {playingFile && (() => {
          const file = vaultFiles.find(f => f.id === playingFile)
          if (!file) return null
          
          const playableUrl = getPlayableUrl(file)
          if (!playableUrl) {
            return (
              <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-white font-semibold">{file.fileName}</h4>
                    <p className="text-sm text-slate-400">{file.songName} - {file.artistName}</p>
                  </div>
                  <button
                    onClick={() => {
                      setPlayingFile(null)
                      setAudioError(null)
                    }}
                    className="p-2 text-slate-400 hover:text-white rounded transition"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-red-400 text-sm">No playable URL available for this file.</p>
              </div>
            )
          }
          
          const isVideo = file.fileType === 'music_video'
          
          return (
            <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-white font-semibold">{file.fileName}</h4>
                  <p className="text-sm text-slate-400">{file.songName} - {file.artistName}</p>
                </div>
                <button
                  onClick={() => {
                    setPlayingFile(null)
                    setAudioError(null)
                  }}
                  className="p-2 text-slate-400 hover:text-white rounded transition"
                >
                  <Pause className="w-5 h-5" />
                </button>
              </div>
              {audioError && (
                <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                  {audioError}
                  <button
                    onClick={() => setAudioError(null)}
                    className="ml-2 text-red-300 hover:text-red-200"
                  >
                    ×
                  </button>
                </div>
              )}
              {isVideo ? (
                <video
                  ref={videoRef}
                  key={playableUrl}
                  src={playableUrl}
                  controls
                  className="w-full rounded-lg"
                  autoPlay
                  onEnded={() => {
                    setPlayingFile(null)
                    setAudioError(null)
                  }}
                  onError={(e) => {
                    console.error('Video playback error:', e)
                    setAudioError('Failed to load video. The file may be corrupted or the URL is invalid.')
                  }}
                  onLoadedData={() => {
                    setAudioError(null)
                    // Auto-play when loaded
                    if (videoRef.current) {
                      videoRef.current.play().catch((err) => {
                        console.error('Video play error:', err)
                        setAudioError('Failed to start video playback. Please click play manually.')
                      })
                    }
                  }}
                />
              ) : (
                <audio
                  ref={audioRef}
                  key={playableUrl}
                  src={playableUrl}
                  controls
                  preload="metadata"
                  className="w-full"
                  autoPlay
                  onEnded={() => {
                    setPlayingFile(null)
                    setAudioError(null)
                  }}
                  onError={(e) => {
                    console.error('Audio playback error:', e)
                    const audioElement = e.currentTarget
                    let errorMsg = 'Failed to load audio. '
                    if (audioElement.error) {
                      switch (audioElement.error.code) {
                        case MediaError.MEDIA_ERR_ABORTED:
                          errorMsg += 'Playback was aborted.'
                          break
                        case MediaError.MEDIA_ERR_NETWORK:
                          errorMsg += 'Network error occurred. Please check your connection.'
                          break
                        case MediaError.MEDIA_ERR_DECODE:
                          errorMsg += 'Audio decoding error. The file may be corrupted.'
                          break
                        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                          errorMsg += 'Audio format not supported or URL is invalid.'
                          break
                        default:
                          errorMsg += 'Unknown error occurred.'
                      }
                    }
                    setAudioError(errorMsg)
                  }}
                  onLoadedData={() => {
                    setAudioError(null)
                    // Auto-play when metadata is loaded
                    if (audioRef.current) {
                      audioRef.current.play().catch((err) => {
                        console.error('Audio play error:', err)
                        // If autoplay fails (e.g., browser policy), just show controls
                        // User can click play manually
                      })
                    }
                  }}
                  onCanPlay={() => {
                    // Try to play when ready
                    if (audioRef.current && audioRef.current.paused) {
                      audioRef.current.play().catch((err) => {
                        // Silently fail - user can use controls
                      })
                    }
                  }}
                />
              )}
            </div>
          )
        })()}
      </div>

      {/* Add File Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Add File to Vault</h2>
            <form onSubmit={handleAddFile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Song Type</label>
                <div className="flex space-x-4 mb-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="songType"
                      checked={!fileFormData.isUnreleased}
                      onChange={() => setFileFormData({ ...fileFormData, isUnreleased: false, songName: '', artistName: '', artistId: '' })}
                      className="text-red-600"
                    />
                    <span className="text-slate-300">From Catalog</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="songType"
                      checked={fileFormData.isUnreleased}
                      onChange={() => setFileFormData({ ...fileFormData, isUnreleased: true, songId: '' })}
                      className="text-red-600"
                    />
                    <span className="text-slate-300">Unreleased Song</span>
                  </label>
                </div>
                {fileFormData.isUnreleased ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Song Name</label>
                      <input
                        type="text"
                        value={fileFormData.songName}
                        onChange={(e) => setFileFormData({ ...fileFormData, songName: e.target.value })}
                        required
                        placeholder="Enter song name"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Artist</label>
                      <select
                        value={fileFormData.artistId && users.some(u => u.id === fileFormData.artistId) ? fileFormData.artistId : ''}
                        onChange={(e) => {
                          const selectedUser = users.find(u => u.id === e.target.value)
                          setFileFormData({ 
                            ...fileFormData, 
                            artistId: e.target.value,
                            artistName: selectedUser?.artistName || selectedUser?.name || ''
                          })
                        }}
                        required
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Select artist...</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.artistName || user.name}
                          </option>
                        ))}
                      </select>
                      {fileFormData.artistId && !users.some(u => u.id === fileFormData.artistId) && (
                        <p className="text-xs text-yellow-400 mt-1">
                          Selected artist not found. Please select an artist from the list.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <select
                    value={fileFormData.songId}
                    onChange={(e) => setFileFormData({ ...fileFormData, songId: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select song...</option>
                    {catalog.map(item => (
                      <option key={item.id} value={item.id}>{item.song} - {item.artist}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Upload Mode</label>
                <div className="flex space-x-4 mb-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      checked={!fileFormData.isFolderUpload}
                      onChange={() => setFileFormData({ ...fileFormData, isFolderUpload: false, file: null, files: null })}
                      className="text-red-600"
                    />
                    <span className="text-slate-300">Single File</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      checked={fileFormData.isFolderUpload}
                      onChange={() => setFileFormData({ ...fileFormData, isFolderUpload: true, file: null, files: null })}
                      className="text-red-600"
                    />
                    <span className="text-slate-300">Folder (Logic Sessions)</span>
                  </label>
                </div>
                {fileFormData.isFolderUpload ? (
                  <input
                    type="file"
                    {...({ webkitdirectory: '' } as any)}
                    multiple
                    onChange={(e) => {
                      const selectedFiles = e.target.files
                      if (selectedFiles && selectedFiles.length > 0) {
                        setFileFormData({
                          ...fileFormData,
                          files: selectedFiles,
                          isFolderUpload: true,
                        })
                      }
                    }}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                  />
                ) : (
                  <input
                    type="file"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0]
                      if (selectedFile) {
                        setFileFormData({
                          ...fileFormData,
                          file: selectedFile,
                          fileName: fileFormData.fileName || selectedFile.name,
                          isFolderUpload: false,
                        })
                      }
                    }}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                  />
                )}
                {fileFormData.isFolderUpload && fileFormData.files && (
                  <p className="text-xs text-slate-400 mt-2">
                    Selected folder with {fileFormData.files.length} file{fileFormData.files.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">File Name (Optional - defaults to uploaded filename)</label>
                <input
                  type="text"
                  value={fileFormData.fileName}
                  onChange={(e) => setFileFormData({ ...fileFormData, fileName: e.target.value })}
                  placeholder="e.g., song_final_mix.logicx"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">File Type</label>
                <select
                  value={fileFormData.fileType}
                  onChange={(e) => setFileFormData({ ...fileFormData, fileType: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="logic">Logic Project</option>
                  <option value="bounced">Bounced Version</option>
                  <option value="stem">Stem</option>
                  <option value="master">Master</option>
                  <option value="music_video">Music Video</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  External Link (Optional)
                  <span className="text-xs text-slate-500 ml-2">e.g., Dropbox, WeTransfer, Google Drive, etc.</span>
                </label>
                <input
                  type="url"
                  value={fileFormData.link}
                  onChange={(e) => setFileFormData({ ...fileFormData, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Folder (Optional - for organizing Logic sessions)</label>
                <input
                  type="text"
                  value={fileFormData.folderPath}
                  onChange={(e) => setFileFormData({ ...fileFormData, folderPath: e.target.value })}
                  placeholder="e.g., Logic Sessions or Logic Sessions/Song Name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty to add to root, or enter folder path like "Logic Sessions"</p>
              </div>
              {isUploading && (
                <ProgressBar
                  isLoading={isUploading}
                  progress={uploadProgress}
                  message={fileFormData.isFolderUpload ? "Uploading folder..." : "Uploading file"}
                  estimatedTime={
                    fileFormData.isFolderUpload && fileFormData.files
                      ? Math.max(5, Math.ceil((Array.from(fileFormData.files).reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)) * 1.5))
                      : fileFormData.file
                      ? Math.max(3, Math.ceil((fileFormData.file.size / (1024 * 1024)) * 1.5))
                      : 5
                  }
                />
              )}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : fileFormData.isFolderUpload ? 'Upload Folder' : 'Upload & Add File'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setFileFormData({ songId: '', songName: '', artistName: '', artistId: '', fileName: '', fileType: 'logic', file: null, files: null, folderPath: '', isFolderUpload: false, isUnreleased: false, link: '' })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

function VideoVaultTab({ user }: { user: any }) {
  const [items, setItems] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newVideo, setNewVideo] = useState({ title: '', videoUrl: '', caption: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/video-vault')
    const data = await res.json()
    if (data.success) setItems(data.items || [])
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const addVideo = async () => {
    if (!newVideo.title || !newVideo.videoUrl || !newVideo.caption) return
    setAdding(true)
    try {
      const res = await fetch('/api/video-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVideo),
      })
      const data = await res.json()
      if (data.success) {
        setNewVideo({ title: '', videoUrl: '', caption: '', description: '' })
        setShowAdd(false)
        fetchItems()
      }
    } finally {
      setAdding(false)
    }
  }

  const copyCaption = (caption: string, id: string) => {
    navigator.clipboard.writeText(caption)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const canEdit = user?.role === 'admin' || user?.role === 'manager'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Video Vault</h2>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            {showAdd ? 'Cancel' : 'Add Video'}
          </button>
        )}
      </div>
      <p className="text-slate-400 text-sm">Store videos with captions. Download or copy captions for posts.</p>

      {showAdd && canEdit && (
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700 space-y-3">
          <input
            type="text"
            placeholder="Title"
            value={newVideo.title}
            onChange={(e) => setNewVideo((v) => ({ ...v, title: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
          />
          <input
            type="url"
            placeholder="Video URL"
            value={newVideo.videoUrl}
            onChange={(e) => setNewVideo((v) => ({ ...v, videoUrl: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
          />
          <textarea
            placeholder="Caption (copy/paste for posts)"
            value={newVideo.caption}
            onChange={(e) => setNewVideo((v) => ({ ...v, caption: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 resize-none"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newVideo.description}
            onChange={(e) => setNewVideo((v) => ({ ...v, description: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
          />
          <button
            onClick={addVideo}
            disabled={adding || !newVideo.title || !newVideo.videoUrl || !newVideo.caption}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition"
          >
            {adding ? 'Adding…' : 'Add to Vault'}
          </button>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">No videos in vault yet.</p>
        ) : (
          items.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-4 rounded-lg bg-slate-800/60 border border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">{v.title}</h3>
                {v.description && (
                  <p className="text-slate-500 text-sm truncate mt-0.5">{v.description}</p>
                )}
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{v.caption}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={v.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
                  title="Download / Open"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => copyCaption(v.caption, v.id)}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
                  title="Copy caption"
                >
                  {copiedId === v.id ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

