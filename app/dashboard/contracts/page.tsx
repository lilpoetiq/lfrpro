'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FileText, Plus, Edit, Trash2, DollarSign, Percent, Calendar, Users, TrendingUp, Upload, ExternalLink, Image } from 'lucide-react'

interface ContractDocument {
  id: string
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedBy?: string
}

interface Contract {
  id: string
  name: string
  songId?: string
  artistIds: string[]
  splits: Array<{
    artistId: string
    artistName: string
    percentage: number
    role?: string
  }>
  effectiveDate: string
  expirationDate?: string
  notes?: string
  createdAt: string
  createdBy: string
  isActive: boolean
  documents?: ContractDocument[]
}

interface CatalogItem {
  id: string
  song: string
  artist: string
  totalStreams: number
}

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    songId: '',
    artistIds: [] as string[],
    splits: [] as Array<{ artistId: string; percentage: number; role: string }>,
    effectiveDate: '',
    expirationDate: '',
    notes: '',
    isActive: true,
  })

  useEffect(() => {
    // For artists, wait until user is loaded so we can filter by artistId
    if (user?.role === 'artist' && !user?.id) return
    fetchContracts()
    fetchCatalog()
    fetchUsers()
  }, [user?.id, user?.role])

  const fetchContracts = async () => {
    try {
      const artistParam = user?.role === 'artist' && user?.id ? `?artistId=${user.id}` : ''
      const res = await fetch(`/api/contracts${artistParam}`)
      const data = await res.json()
      if (data.success) {
        setContracts(data.contracts)
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog')
      const data = await res.json()
      if (data.success) {
        setCatalog(data.catalog)
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const calculateRevenue = (contract: Contract, streams: number): Record<string, number> => {
    const revenuePerStream = 0.003 // $0.003 per stream
    const totalRevenue = streams * revenuePerStream
    const artistRevenue: Record<string, number> = {}
    
    contract.splits.forEach(split => {
      artistRevenue[split.artistId] = (totalRevenue * split.percentage) / 100
    })
    
    return artistRevenue
  }

  const getTotalPercentage = (splits: Array<{ percentage: number }>) => {
    return splits.reduce((sum, split) => sum + split.percentage, 0)
  }

  const handleAddSplit = () => {
    setFormData({
      ...formData,
      splits: [...formData.splits, { artistId: '', percentage: 0, role: 'Artist' }],
    })
  }

  const handleRemoveSplit = (index: number) => {
    setFormData({
      ...formData,
      splits: formData.splits.filter((_, i) => i !== index),
    })
  }

  const handleSplitChange = (index: number, field: string, value: any) => {
    const newSplits = [...formData.splits]
    newSplits[index] = { ...newSplits[index], [field]: value }
    setFormData({ ...formData, splits: newSplits })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const totalPercentage = getTotalPercentage(formData.splits)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`Split percentages must add up to 100%. Current total: ${totalPercentage.toFixed(2)}%`)
      return
    }

    if (formData.splits.length === 0) {
      alert('Please add at least one artist split')
      return
    }

    try {
      const method = editingContract ? 'PUT' : 'POST'
      const url = '/api/contracts'
      const body = editingContract
        ? { id: editingContract.id, ...formData, createdBy: user?.name || '' }
        : { ...formData, createdBy: user?.name || '' }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setEditingContract(null)
        setFormData({
          name: '',
          songId: '',
          artistIds: [],
          splits: [],
          effectiveDate: '',
          expirationDate: '',
          notes: '',
          isActive: true,
        })
        fetchContracts()
      } else {
        alert(data.error || 'Failed to save contract')
      }
    } catch (error: any) {
      console.error('Failed to save contract:', error)
      alert(error.message || 'Failed to save contract')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return

    try {
      const res = await fetch(`/api/contracts?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchContracts()
      } else {
        alert(data.error || 'Failed to delete contract')
      }
    } catch (error) {
      console.error('Failed to delete contract:', error)
      alert('Failed to delete contract')
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingContractId, setUploadingContractId] = useState<string | null>(null)
  const [pendingUploadContractId, setPendingUploadContractId] = useState<string | null>(null)

  const handleUploadDocument = async (contractId: string, file: File) => {
    setUploadingContractId(contractId)
    try {
      const formData = new FormData()
      formData.append('contractId', contractId)
      formData.append('file', file)
      formData.append('userId', user?.id || '')

      const res = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        fetchContracts()
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (error: any) {
      alert(error.message || 'Upload failed')
    } finally {
      setUploadingContractId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract)
    // Filter out artist IDs that don't exist in users list
    const validArtistIds = contract.artistIds.filter(id => users.some(u => u.id === id))
    setFormData({
      name: contract.name,
      songId: contract.songId || '',
      artistIds: validArtistIds,
      splits: contract.splits
        .filter(s => users.some(u => u.id === s.artistId)) // Only include splits with valid artists
        .map(s => ({
          artistId: s.artistId,
          percentage: s.percentage,
          role: s.role || 'Artist',
        })),
      effectiveDate: contract.effectiveDate.split('T')[0],
      expirationDate: contract.expirationDate ? contract.expirationDate.split('T')[0] : '',
      notes: contract.notes || '',
      isActive: contract.isActive,
    })
    setShowAddModal(true)
  }

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
          <h1 className="text-3xl font-bold text-white mb-2">Contracts</h1>
          <p className="text-slate-400">Manage revenue splits and artist contracts</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => {
              setEditingContract(null)
              setFormData({
                name: '',
                songId: '',
                artistIds: [],
                splits: [],
                effectiveDate: '',
                expirationDate: '',
                notes: '',
                isActive: true,
              })
              setShowAddModal(true)
            }}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>Add Contract</span>
          </button>
        )}
      </div>

      {/* Contracts List */}
      <div className="space-y-4">
        {contracts.length === 0 ? (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 shadow-lg text-center">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No contracts found</p>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <p className="text-sm text-slate-500">Create your first contract to start managing revenue splits</p>
            )}
          </div>
        ) : (
          contracts.map((contract) => {
            const song = contract.songId ? catalog.find(s => s.id === contract.songId) : null
            const streams = song?.totalStreams || 0
            const revenue = calculateRevenue(contract, streams)
            const totalRevenue = streams * 0.003

            return (
              <div
                key={contract.id}
                className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{contract.name}</h3>
                      {!contract.isActive && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">Inactive</span>
                      )}
                      {contract.expirationDate && new Date(contract.expirationDate) < new Date() && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Expired</span>
                      )}
                    </div>
                    {song && (
                      <p className="text-slate-400 text-sm">
                        Song: <span className="text-white">{song.song}</span> by <span className="text-white">{song.artist}</span>
                      </p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">
                      Effective: {new Date(contract.effectiveDate).toLocaleDateString()}
                      {contract.expirationDate && ` - Expires: ${new Date(contract.expirationDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(contract)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contract.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Revenue Breakdown */}
                {song && streams > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-semibold text-slate-300">Revenue Breakdown</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-xs text-slate-400">{streams.toLocaleString()} streams</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {contract.splits.map((split) => {
                        const artistRevenue = revenue[split.artistId] || 0
                        return (
                          <div key={split.artistId} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                            <div className="flex items-center space-x-3">
                              <Users className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="text-sm text-white font-medium">{split.artistName}</p>
                                {split.role && <p className="text-xs text-slate-400">{split.role}</p>}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-green-400">
                                  ${artistRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-slate-400">{split.percentage}%</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Split Percentages */}
                <div className="border-t border-slate-800 pt-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center space-x-2">
                    <Percent className="w-4 h-4" />
                    <span>Split Percentages</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {contract.splits.map((split) => (
                      <div key={split.artistId} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                        <div>
                          <p className="text-sm text-white font-medium">{split.artistName}</p>
                          {split.role && <p className="text-xs text-slate-400">{split.role}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{ width: `${split.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-white w-12 text-right">{split.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {contract.notes && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-sm text-slate-400">{contract.notes}</p>
                  </div>
                )}

                {/* Contract documents (photo copies) */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Contract Documents
                    </h4>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            const cid = pendingUploadContractId
                            setPendingUploadContractId(null)
                            if (file && cid) {
                              handleUploadDocument(cid, file)
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            setPendingUploadContractId(contract.id)
                            fileInputRef.current?.click()
                          }}
                          disabled={uploadingContractId === contract.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition"
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingContractId === contract.id ? 'Uploading…' : 'Upload Photo/PDF'}
                        </button>
                      </>
                    )}
                  </div>
                  {contract.documents && contract.documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {contract.documents.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.fileUrl.startsWith('http') ? doc.fileUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${doc.fileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-red-500/50 transition"
                        >
                          <FileText className="w-8 h-8 text-red-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-medium truncate">{doc.fileName}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No contract documents uploaded yet.
                      {(user?.role === 'admin' || user?.role === 'manager') && ' Upload photo copies so artists can view their contracts.'}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingContract ? 'Edit Contract' : 'Add Contract'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Contract Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Song Title - Revenue Split"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Song (Optional)</label>
                <select
                  value={formData.songId}
                  onChange={(e) => setFormData({ ...formData, songId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a song (optional)</option>
                  {catalog.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.song} - {song.artist}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Effective Date</label>
                <input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">Artist Splits</label>
                  <button
                    type="button"
                    onClick={handleAddSplit}
                    className="text-sm text-red-400 hover:text-red-300 flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Artist</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.splits.map((split, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 bg-slate-800/50 rounded-lg">
                      <select
                        value={split.artistId && users.some(u => u.id === split.artistId && u.role === 'artist') ? split.artistId : ''}
                        onChange={(e) => handleSplitChange(index, 'artistId', e.target.value)}
                        required
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Select artist</option>
                        {users.filter(u => u.role === 'artist').map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.artistName || u.name}
                          </option>
                        ))}
                      </select>
                      {split.artistId && !users.some(u => u.id === split.artistId && u.role === 'artist') && (
                        <span className="text-xs text-yellow-400">Artist not found</span>
                      )}
                      <input
                        type="text"
                        value={split.role}
                        onChange={(e) => handleSplitChange(index, 'role', e.target.value)}
                        placeholder="Role"
                        className="w-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <input
                        type="number"
                        value={split.percentage}
                        onChange={(e) => handleSplitChange(index, 'percentage', parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        placeholder="%"
                        className="w-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSplit(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {formData.splits.length > 0 && (
                  <div className="mt-2 text-sm text-slate-400">
                    Total: <span className={getTotalPercentage(formData.splits) === 100 ? 'text-green-400' : 'text-red-400'}>
                      {getTotalPercentage(formData.splits).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-red-600 bg-slate-800 border-slate-700 rounded focus:ring-red-500"
                />
                <label htmlFor="isActive" className="text-sm text-slate-300">Active Contract</label>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                >
                  {editingContract ? 'Update Contract' : 'Create Contract'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingContract(null)
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

