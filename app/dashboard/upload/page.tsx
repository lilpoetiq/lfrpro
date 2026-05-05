'use client'

import { useState, useEffect } from 'react'
import { Upload, Trash2, FileText, Calendar, X, Users } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import ProgressBar from '@/components/ProgressBar'

interface UploadItem {
  id: string
  fileName: string
  uploadedAt: any
  rowCount: number
  lastUpdated?: any
}

export default function UploadDataPage() {
  const { user } = useAuth()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  useEffect(() => {
    fetchUploads()
  }, [])

  const fetchUploads = async () => {
    try {
      const res = await fetch('/api/get-uploads')
      const data = await res.json()
      if (data.success) {
        setUploads(data.uploads)
      }
    } catch (error) {
      console.error('Failed to fetch uploads:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadStatus('Please select a valid CSV file')
      return
    }

    setCsvFile(file)
    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus('Uploading CSV file...')
    
    // Estimate time based on file size (roughly 1MB per second)
    const estimatedUploadTime = Math.max(5, Math.ceil(file.size / (1024 * 1024))) // seconds

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(90, prev + 10))
      }, estimatedUploadTime * 100)

      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Upload failed')
      }

      if (data.success) {
        const artistsMsg = data.artistsFound && data.artistsFound.length > 0
          ? ` Found ${data.artistsFound.length} artist(s): ${data.artistsFound.join(', ')}`
          : ''
        
        setUploadStatus(`✓ CSV uploaded successfully! ${data.rowCount} rows processed.${artistsMsg}`)
        setCsvFile(null)
        fetchUploads()
        
        // Start analysis progress tracking if analysis was triggered
        if (data.analysisTriggered) {
          setIsAnalyzing(true)
          setAnalysisProgress(0)
          setUploadStatus(prev => prev + ' Starting AI analysis...')
          
          // Poll for analysis completion
          pollForAnalysis(data.id)
        }
        
        // Reset file input
        const input = document.getElementById('csv-upload') as HTMLInputElement
        if (input) input.value = ''
      } else {
        setUploadStatus(`Error: ${data.error || 'Unknown error occurred'}`)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      setUploadStatus(`Upload failed: ${error.message || 'Please check your file and try again'}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Get average analysis time from localStorage
  const getAverageAnalysisTime = (): number => {
    try {
      const stored = localStorage.getItem('analysisTimes')
      if (!stored) return 35 // Default 35 seconds
      const times = JSON.parse(stored) as number[]
      if (times.length === 0) return 35
      const sum = times.reduce((a, b) => a + b, 0)
      return Math.round(sum / times.length)
    } catch {
      return 35
    }
  }

  // Store analysis time in localStorage
  const storeAnalysisTime = (timeInSeconds: number) => {
    try {
      const stored = localStorage.getItem('analysisTimes')
      const times = stored ? JSON.parse(stored) as number[] : []
      times.push(timeInSeconds)
      // Keep only last 10 analysis times
      const recentTimes = times.slice(-10)
      localStorage.setItem('analysisTimes', JSON.stringify(recentTimes))
    } catch {
      // Ignore localStorage errors
    }
  }

  const pollForAnalysis = async (uploadId: string) => {
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max (5 second intervals)
    const estimatedAnalysisTime = getAverageAnalysisTime() || 35 // Use learned average, default to 35
    
    setAnalysisProgress(0)
    
    // Update progress bar immediately with estimated time
    setAnalysisProgress(0)

    // Progress update interval (more frequent for smoother progress bar)
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      // Calculate progress based on elapsed time vs estimated time
      const progress = Math.min(95, (elapsed / estimatedAnalysisTime) * 100)
      setAnalysisProgress(progress)
    }, 100) // Update every 100ms for smooth progress

    const checkInterval = setInterval(async () => {
      attempts++
      
      try {
        const res = await fetch('/api/get-analyses')
        const data = await res.json()
        
        if (data.success && data.analyses.length > 0) {
          const latestAnalysis = data.analyses[0]
          // Check if this analysis is for our upload (by checking if it's recent)
          const analysisTime = new Date(latestAnalysis.generatedAt).getTime()
          const now = Date.now()
          
          // If analysis was generated in the last 2 minutes, assume it's ours
          if (now - analysisTime < 120000) {
            const actualTime = Math.floor((now - startTime) / 1000)
            storeAnalysisTime(actualTime) // Learn from this time
            
            clearInterval(checkInterval)
            clearInterval(progressInterval)
            setAnalysisProgress(100)
            setIsAnalyzing(false)
            setUploadStatus(prev => prev.replace(' Starting AI analysis...', ` ✓ AI analysis completed! (finished in ${actualTime} seconds)`))
            fetchUploads()
            return
          }
        }
        
        // Update progress based on elapsed time
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const progress = Math.min(95, (elapsed / estimatedAnalysisTime) * 100)
        setAnalysisProgress(progress)
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          clearInterval(progressInterval)
          setIsAnalyzing(false)
          setUploadStatus(prev => prev.replace(' Starting AI analysis...', ' (Analysis may still be processing)'))
        }
      } catch (error) {
        console.error('Failed to check analysis status:', error)
      }
    }, 5000) // Check every 5 seconds
  }

  const handleCreateAccounts = async (uploadId: string) => {
    if (!confirm('Create accounts for all artists found in this CSV? Default passwords will be set as [artistname]123')) return

    setIsCreatingAccounts(true)
    try {
      const res = await fetch('/api/create-artist-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      })

      const data = await res.json()

      if (data.success) {
        const accountsMsg = data.created > 0
          ? `✓ Created ${data.created} account(s). Default passwords: [artistname]123`
          : 'No new accounts created (may already exist)'
        setUploadStatus(accountsMsg)
        if (data.accounts && data.accounts.length > 0) {
          console.log('Created accounts:', data.accounts)
        }
      } else {
        setUploadStatus(`Error: ${data.error || 'Failed to create accounts'}`)
      }
    } catch (error: any) {
      console.error('Create accounts error:', error)
      setUploadStatus(`Failed to create accounts: ${error.message}`)
    } finally {
      setIsCreatingAccounts(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this upload?')) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/delete-upload?id=${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        setUploads(uploads.filter(u => u.id !== id))
        setUploadStatus('✓ Upload deleted successfully')
        setTimeout(() => setUploadStatus(''), 3000)
      } else {
        setUploadStatus(`Error: ${data.error}`)
      }
    } catch (error: any) {
      setUploadStatus(`Delete failed: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Upload Data</h1>
        <p className="text-slate-400">Upload CSV files with streaming and performance data</p>
      </div>

      {/* Upload Section */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-red-500" />
          Upload CSV File
        </h2>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-red-600 transition">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="csv-upload"
              className={`cursor-pointer flex flex-col items-center ${isUploading ? 'opacity-50' : ''}`}
            >
              <Upload className="w-16 h-16 text-slate-500 mb-4" />
              <p className="text-sm text-slate-400 mb-2">
                {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-slate-500">
                CSV files only
              </p>
            </label>
          </div>
          {uploadStatus && (
            <div className="space-y-3">
              <div
                className={`p-4 rounded-lg text-sm ${
                  uploadStatus.includes('✓')
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : uploadStatus.includes('Error') || uploadStatus.includes('failed')
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {uploadStatus}
              </div>
              {isUploading && csvFile && (
                <ProgressBar
                  isLoading={isUploading}
                  progress={uploadProgress}
                  message="Uploading CSV file"
                  estimatedTime={Math.max(5, Math.ceil(csvFile.size / (1024 * 1024)))}
                />
              )}
              {isAnalyzing && (
                <ProgressBar
                  isLoading={isAnalyzing}
                  progress={analysisProgress}
                  message="Analyzing data with AI"
                  estimatedTime={getAverageAnalysisTime()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-red-500" />
          Upload History
        </h2>
        {uploads.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No uploads yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">File Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Rows</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Uploaded</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr
                    key={upload.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3 px-4 text-white font-medium text-sm">
                      {upload.fileName}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {upload.rowCount}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {formatTimeAgo(upload.lastUpdated || upload.uploadedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleCreateAccounts(upload.id)}
                            disabled={isCreatingAccounts}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition disabled:opacity-50 flex items-center space-x-1"
                            title="Create accounts for artists in this CSV"
                          >
                            {isCreatingAccounts ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                            ) : (
                              <>
                                <Users className="w-4 h-4" />
                                <span className="text-xs">Create Accounts</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(upload.id)}
                          disabled={deletingId === upload.id}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition disabled:opacity-50"
                        >
                          {deletingId === upload.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

