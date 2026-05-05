'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Calendar, Upload, Image as ImageIcon, Music, AlertCircle, CheckCircle, Loader2, Users, Sparkles, MessageSquare, Hash, FileText, Info, Mail, HelpCircle, X } from 'lucide-react'

export default function SubmitReleasePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    songName: '',
    releaseDate: '',
    releaseType: 'single' as 'single' | 'ep' | 'album',
    genre: '',
    collaborators: '',
    description: '',
    promoIdeas: '',
    instagramHandle: '',
    twitterHandle: '',
    tiktokHandle: '',
    hasCover: false,
    hasMaster: true, // Master is required
  })

  const [songs, setSongs] = useState<Array<{ name: string; masterFile: File | null }>>([
    { name: '', masterFile: null }
  ])

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [masterFile, setMasterFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false)
  const [questionSuccess, setQuestionSuccess] = useState(false)


  // Calculate minimum date (3 days from today)
  const getMinDate = () => {
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 3)
    return minDate.toISOString().split('T')[0]
  }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate image file
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file for the cover')
        return
      }
      setCoverFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setCoverPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMasterChange = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0]
    if (file) {
      // Accept any file type - no validation needed
      if (index !== undefined) {
        // Update song in array
        const updatedSongs = [...songs]
        updatedSongs[index].masterFile = file
        setSongs(updatedSongs)
      } else {
        // Single song master
        setMasterFile(file)
      }
    }
  }

  const addSong = () => {
    setSongs([...songs, { name: '', masterFile: null }])
  }

  const removeSong = (index: number) => {
    if (songs.length > 1) {
      setSongs(songs.filter((_, i) => i !== index))
    }
  }

  const updateSongName = (index: number, name: string) => {
    const updatedSongs = [...songs]
    updatedSongs[index].name = name
    setSongs(updatedSongs)
  }

  const validateForm = () => {
    if (!formData.songName.trim()) {
      setError('Song name is required')
      return false
    }

    if (!formData.releaseDate) {
      setError('Release date is required')
      return false
    }

    // Validate 3 days minimum
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const releaseDate = new Date(formData.releaseDate)
    releaseDate.setHours(0, 0, 0, 0)
    const daysDiff = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff < 3) {
      setError('Release date must be at least 3 days in advance')
      return false
    }

    // Validate songs based on release type
    if (formData.releaseType === 'single') {
      if (!masterFile) {
        setError('Master audio file is required')
        return false
      }
      if (!formData.songName.trim()) {
        setError('Song name is required')
        return false
      }
    } else {
      // Album or EP - need multiple songs
      if (songs.length === 0) {
        setError('Please add at least one song')
        return false
      }
      const invalidSongs = songs.filter(s => !s.name.trim() || !s.masterFile)
      if (invalidSongs.length > 0) {
        setError('All songs must have a name and master file')
        return false
      }
      if (!formData.songName.trim()) {
        setError('Album/EP name is required')
        return false
      }
    }

    if (formData.hasCover && !coverFile) {
      setError('Please upload a cover image')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const formDataToSend = new FormData()
      
      // Append text fields (always append, even if empty)
      formDataToSend.append('songName', formData.songName.trim() || '')
      formDataToSend.append('releaseDate', formData.releaseDate || '')
      formDataToSend.append('releaseType', formData.releaseType || 'single')
      formDataToSend.append('genre', formData.genre.trim() || '')
      formDataToSend.append('collaborators', formData.collaborators.trim() || '')
      formDataToSend.append('description', formData.description.trim() || '')
      formDataToSend.append('promoIdeas', formData.promoIdeas.trim() || '')
      formDataToSend.append('instagramHandle', formData.instagramHandle.trim() || '')
      formDataToSend.append('twitterHandle', formData.twitterHandle.trim() || '')
      formDataToSend.append('tiktokHandle', formData.tiktokHandle.trim() || '')
      formDataToSend.append('hasCover', formData.hasCover.toString())
      formDataToSend.append('userId', user?.id || '')
      formDataToSend.append('artistName', user?.name || user?.artistName || '')
      
      // Add songs for albums/EPs
      if (formData.releaseType === 'album' || formData.releaseType === 'ep') {
        const songsData = songs.map(s => ({ name: s.name.trim() })).filter(s => s.name)
        formDataToSend.append('songs', JSON.stringify(songsData))
        
        songs.forEach((song, index) => {
          if (song.masterFile) {
            // Validate file size
            if (song.masterFile.size === 0) {
              throw new Error(`Master file for "${song.name || `Song ${index + 1}`}" is empty. Please select a valid audio file.`)
            }
            formDataToSend.append(`songMaster_${index}`, song.masterFile)
          }
        })
      } else {
        // Single song
        if (masterFile) {
          // Validate file size
          if (masterFile.size === 0) {
            throw new Error('Master audio file is empty. Please select a valid audio file.')
          }
          formDataToSend.append('master', masterFile)
        }
      }
      
      // Add cover file if provided
      if (coverFile) {
        if (coverFile.size === 0) {
          throw new Error('Cover image file is empty. Please select a valid image file.')
        }
        formDataToSend.append('cover', coverFile)
      }

      // Send request - browser will automatically set Content-Type with boundary
      const response = await fetch('/api/release-request', {
        method: 'POST',
        body: formDataToSend,
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: `Request failed (${response.status} ${response.statusText})` }
        }
        const errorMessage = errorData.details || errorData.error || 'Failed to submit release request'
        console.error('[RELEASE REQUEST] API error:', { status: response.status, errorData })
        throw new Error(errorMessage)
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error('Server returned an invalid response. Please try again.')
      }

      setSuccess(true)
      // Reset form
      setFormData({
        songName: '',
        releaseDate: '',
        releaseType: 'single',
        genre: '',
        collaborators: '',
        description: '',
        promoIdeas: '',
        instagramHandle: '',
        twitterHandle: '',
        tiktokHandle: '',
        hasCover: false,
        hasMaster: true,
      })
      setSongs([{ name: '', masterFile: null }])
      setCoverFile(null)
      setMasterFile(null)
      setCoverPreview(null)

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/releases')
      }, 2000)
    } catch (err: any) {
      console.error('Submit error:', err)
      const errorMessage = err.message || 'Failed to submit release request. Please try again.'
      setError(errorMessage)
      // Log to console for debugging
      if (err.response) {
        console.error('Response error:', err.response)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user || user.role !== 'artist') {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">Only artists can submit release requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Submit Release Request</h1>
        <p className="text-slate-400 text-sm sm:text-base">Request a release date for your song. Minimum 3 days advance notice required. All fields help us plan and promote your release effectively.</p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-400 font-semibold">Release request submitted successfully!</p>
            <p className="text-green-300 text-sm mt-1">Your request is pending admin approval. Redirecting to releases...</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Main Release Info */}
          <div className="space-y-6">
            {/* Basic Release Information */}
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center space-x-2 mb-4">
                <Music className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-semibold text-white">Release Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {formData.releaseType === 'single' ? 'Song Name *' : 'Album/EP Name *'}
              </label>
              <input
                type="text"
                value={formData.songName}
                onChange={(e) => setFormData({ ...formData, songName: e.target.value })}
                required
                placeholder={formData.releaseType === 'single' ? 'Enter song name' : 'Enter album/EP name'}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Release Type *
              </label>
              <select
                value={formData.releaseType}
                onChange={(e) => setFormData({ ...formData, releaseType: e.target.value as 'single' | 'ep' | 'album' })}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isSubmitting}
              >
                <option value="single">Single</option>
                <option value="ep">EP</option>
                <option value="album">Album</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Genre
              </label>
              <input
                type="text"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                placeholder="e.g., Hip-Hop, R&B, Pop"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isSubmitting}
              />
            </div>


            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Collaborators (if any)
              </label>
              <input
                type="text"
                value={formData.collaborators}
                onChange={(e) => setFormData({ ...formData, collaborators: e.target.value })}
                placeholder="e.g., Artist1 & Artist2"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isSubmitting}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Release Date * (Minimum 3 days in advance)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  value={formData.releaseDate}
                  onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                  min={getMinDate()}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Earliest available date: {new Date(getMinDate()).toLocaleDateString()}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description / Notes
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell us about this release, any special notes, or background information..."
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                disabled={isSubmitting}
              />
            </div>
              </div>
            </div>
          </div>

            {/* Master Audio File(s) */}
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Music className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-semibold text-white">
                {formData.releaseType === 'single' ? 'Master Audio File' : 'Songs & Master Files'}
              </h2>
            </div>
            {(formData.releaseType === 'album' || formData.releaseType === 'ep') && (
              <button
                type="button"
                onClick={addSong}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium flex items-center space-x-2"
                disabled={isSubmitting}
              >
                <Music className="w-4 h-4" />
                <span>Add Song</span>
              </button>
            )}
          </div>

          {formData.releaseType === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Master Audio File * (Required)
              </label>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-red-500/50 transition">
                <input
                  type="file"
                  accept="audio/*,*"
                  onChange={handleMasterChange}
                  required
                  className="hidden"
                  id="master-upload"
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="master-upload"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <Music className="w-12 h-12 text-slate-400" />
                  <span className="text-slate-300 font-medium">
                    {masterFile ? masterFile.name : 'Click to upload master audio file'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Any audio file format
                  </span>
                </label>
              </div>
              {masterFile && (
                <p className="text-xs text-green-400 mt-2 flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Master file selected: {masterFile.name} ({(masterFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Add all songs for your {formData.releaseType.toUpperCase()}. Each song needs a name and master file.
              </p>
              {songs.map((song, index) => (
                <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-300">Song {index + 1}</h3>
                    {songs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSong(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Song Name *
                      </label>
                      <input
                        type="text"
                        value={song.name}
                        onChange={(e) => updateSongName(index, e.target.value)}
                        placeholder={`Enter song ${index + 1} name`}
                        required
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Master File *
                      </label>
                      <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-red-500/50 transition">
                        <input
                          type="file"
                          accept="audio/*,*"
                          onChange={(e) => handleMasterChange(e, index)}
                          required
                          className="hidden"
                          id={`song-master-${index}`}
                          disabled={isSubmitting}
                        />
                        <label
                          htmlFor={`song-master-${index}`}
                          className="cursor-pointer flex flex-col items-center space-y-2"
                        >
                          <Music className="w-8 h-8 text-slate-400" />
                          <span className="text-slate-300 text-sm font-medium">
                            {song.masterFile ? song.masterFile.name : 'Click to upload master'}
                          </span>
                          <span className="text-xs text-slate-500">
                            MP3, WAV, M4A, FLAC, or AAC
                          </span>
                        </label>
                      </div>
                      {song.masterFile && (
                        <p className="text-xs text-green-400 mt-1 flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>{song.masterFile.name} ({(song.masterFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}
            </div>

            {/* Album Cover */}
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center space-x-2 mb-4">
                <ImageIcon className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-semibold text-white">Album Cover (Optional)</h2>
              </div>
              
              <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="hasCover"
                checked={formData.hasCover}
                onChange={(e) => setFormData({ ...formData, hasCover: e.target.checked })}
                className="w-4 h-4 text-red-600 bg-slate-800 border-slate-700 rounded focus:ring-red-500"
                disabled={isSubmitting}
              />
              <label htmlFor="hasCover" className="text-slate-300">
                I have an album cover image
              </label>
            </div>

            {formData.hasCover && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cover Image
                </label>
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-red-500/50 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                    id="cover-upload"
                    disabled={isSubmitting}
                  />
                  <label
                    htmlFor="cover-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="max-w-full max-h-64 rounded-lg"
                      />
                    ) : (
                      <>
                        <ImageIcon className="w-12 h-12 text-slate-400" />
                        <span className="text-slate-300 font-medium">Click to upload cover image</span>
                        <span className="text-xs text-slate-500">JPG, PNG, or WebP</span>
                      </>
                    )}
                  </label>
                </div>
                {coverFile && (
                  <p className="text-xs text-green-400 mt-2 flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Cover selected: {coverFile.name}</span>
                  </p>
                )}
              </div>
            )}
              </div>
            </div>
          </div>

            {/* Important Notes */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                  <p className="font-semibold mb-1">Important Information:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-200/90">
                    <li>Release date must be at least 3 days in advance</li>
                    <li>We'll check for date conflicts and suggest alternatives if needed</li>
                    <li>Master audio file is required for distribution</li>
                    <li>All requests are subject to admin approval</li>
                    <li>You'll be notified once your request is reviewed</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Support Contact */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start space-x-3">
            <HelpCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-300 mb-2">Need Help?</p>
              <p className="text-sm text-slate-400 mb-3">
                If you have questions or need assistance with your release request, please contact our support team.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowQuestionModal(true)}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Ask a Question</span>
                </button>
                <a
                  href="mailto:support@legendaryfyrerecords.com"
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 border border-slate-600 hover:border-red-500 text-red-400 hover:text-red-300 rounded-lg transition group text-sm"
                >
                  <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Email Support</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Question Modal */}
        {showQuestionModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Ask a Question</h3>
                <button
                  onClick={() => {
                    setShowQuestionModal(false)
                    setQuestionText('')
                    setQuestionSuccess(false)
                  }}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {questionSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-white mb-2">Question Submitted!</p>
                  <p className="text-slate-400">
                    Our team will get back to you soon via SMS or email.
                  </p>
                  <button
                    onClick={() => {
                      setShowQuestionModal(false)
                      setQuestionText('')
                      setQuestionSuccess(false)
                    }}
                    className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-slate-400 mb-4">
                    Have a question about your release request? Our team will respond via SMS or email.
                  </p>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="What can we help you with?"
                    className="w-full h-32 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                  <div className="flex items-center justify-end space-x-3 mt-4">
                    <button
                      onClick={() => {
                        setShowQuestionModal(false)
                        setQuestionText('')
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!questionText.trim()) {
                          setError('Please enter your question')
                          return
                        }

                        setIsSubmittingQuestion(true)
                        setError('')

                        try {
                          const res = await fetch('/api/artist-support', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              question: questionText.trim(),
                              userId: user?.id,
                              context: 'Release Request Form',
                              category: 'release',
                              urgency: 'high',
                            }),
                          })

                          const data = await res.json()

                          if (data.success) {
                            setQuestionSuccess(true)
                            setQuestionText('')
                          } else {
                            setError(data.error || 'Failed to submit question')
                          }
                        } catch (err: any) {
                          setError(err.message || 'Failed to submit question')
                        } finally {
                          setIsSubmittingQuestion(false)
                        }
                      }}
                      disabled={isSubmittingQuestion || !questionText.trim()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition font-medium flex items-center space-x-2"
                    >
                      {isSubmittingQuestion ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          <span>Submit Question</span>
                        </>
                      )}
                    </button>
                  </div>
                  {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Submit Release Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

