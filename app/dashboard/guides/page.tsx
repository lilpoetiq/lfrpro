'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BookOpen, Plus, Edit, Trash2, X, Save, Users, Eye, EyeOff, Image as ImageIcon, Upload } from 'lucide-react'
import GuideContentRenderer from '@/components/GuideContentRenderer'

interface Guide {
  id: string
  title: string
  content: string
  createdBy: string
  createdAt: string
  updatedAt: string
  assignedTo: string[]
  isActive: boolean
}

interface User {
  id: string
  name: string
  role: string
}

export default function GuidesPage() {
  const { user } = useAuth()
  const [guides, setGuides] = useState<Guide[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    assignedTo: [] as string[],
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showAssignedGuides, setShowAssignedGuides] = useState(true)
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null)

  // Check if user is Eric (the owner)
  const isEric = user && (
    user.id === '1' || 
    user.username === 'admin' || 
    (user.name?.toLowerCase().includes('eric') && user.role === 'admin')
  )

  useEffect(() => {
    fetchGuides()
    fetchUsers()
    fetchAssignedGuides()
  }, [user])

  const fetchGuides = async () => {
    try {
      const res = await fetch('/api/guides')
      const data = await res.json()
      if (data.success) {
        setGuides(data.guides)
      }
    } catch (error) {
      console.error('Failed to fetch guides:', error)
    } finally {
      setIsLoading(false)
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

  const fetchAssignedGuides = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/guides?userId=${user.id}`)
      const data = await res.json()
      if (data.success && data.guides.length > 0) {
        // Store assigned guides in state for popup display
        setAssignedGuides(data.guides)
      }
    } catch (error) {
      console.error('Failed to fetch assigned guides:', error)
    }
  }

  const [assignedGuides, setAssignedGuides] = useState<Guide[]>([])

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Please fill in title and content')
      return
    }

    if (!isEric) {
      alert('Only Eric can create guides')
      return
    }

    try {
      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          assignedTo: formData.assignedTo,
          createdBy: user?.id,
          userRole: user?.role,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowCreateModal(false)
        setFormData({ title: '', content: '', assignedTo: [] })
        fetchGuides()
        // Notify assigned users
        if (formData.assignedTo.length > 0) {
          fetchAssignedGuides()
        }
      } else {
        alert('Failed to create guide: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create guide:', error)
      alert('Failed to create guide')
    }
  }

  const handleUpdate = async () => {
    if (!editingGuide) return

    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Please fill in title and content')
      return
    }

    if (!isEric) {
      alert('Only Eric can update guides')
      return
    }

    try {
      const res = await fetch('/api/guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGuide.id,
          updates: {
            title: formData.title,
            content: formData.content,
            assignedTo: formData.assignedTo,
          },
          userRole: user?.role,
          userId: user?.id,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setEditingGuide(null)
        setFormData({ title: '', content: '', assignedTo: [] })
        fetchGuides()
        fetchAssignedGuides()
      } else {
        alert('Failed to update guide: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update guide:', error)
      alert('Failed to update guide')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this guide?')) return

    if (!isEric) {
      alert('Only Eric can delete guides')
      return
    }

    try {
      const res = await fetch(`/api/guides?id=${id}&userId=${user?.id}&userName=${user?.name}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        fetchGuides()
        fetchAssignedGuides()
      } else {
        alert('Failed to delete guide: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete guide:', error)
      alert('Failed to delete guide')
    }
  }

  const toggleActive = async (guide: Guide) => {
    if (!isEric) return

    try {
      const res = await fetch('/api/guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          updates: { isActive: !guide.isActive },
          userRole: user?.role,
          userId: user?.id,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchGuides()
        fetchAssignedGuides()
      }
    } catch (error) {
      console.error('Failed to toggle guide:', error)
    }
  }

  const openEditModal = (guide: Guide) => {
    setEditingGuide(guide)
    setFormData({
      title: guide.title,
      content: guide.content,
      assignedTo: guide.assignedTo,
    })
  }

  const toggleUserAssignment = (userId: string) => {
    if (formData.assignedTo.includes(userId)) {
      setFormData({
        ...formData,
        assignedTo: formData.assignedTo.filter(id => id !== userId),
      })
    } else {
      setFormData({
        ...formData,
        assignedTo: [...formData.assignedTo, userId],
      })
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    setUploadingImage(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', file)
      formDataToSend.append('category', 'guides')
      formDataToSend.append('userId', user.id)
      formDataToSend.append('uploadedBy', user.name || 'Admin')

      const res = await fetch('/api/upload-file', {
        method: 'POST',
        body: formDataToSend,
      })

      const data = await res.json()

      if (data.success && data.fileUrl) {
        // Insert image markdown at cursor position or end of content
        const imageMarkdown = `\n![${file.name}](${data.fileUrl})\n`
        setFormData({
          ...formData,
          content: formData.content + imageMarkdown,
        })
      } else {
        alert('Failed to upload image: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to upload image:', error)
      alert('Failed to upload image')
    } finally {
      setUploadingImage(false)
      // Reset input
      e.target.value = ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Single Guide Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-6 h-6" />
                <span>{selectedGuide.title}</span>
              </h2>
              <button
                onClick={() => setSelectedGuide(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-slate-300 text-sm mb-4">
              <GuideContentRenderer content={selectedGuide.content} />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-500">
                Updated: {new Date(selectedGuide.updatedAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => setSelectedGuide(null)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Guides Popup */}
      {showAssignedGuides && assignedGuides.length > 0 && !selectedGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-6 h-6" />
                <span>Your Guides & Handbooks</span>
              </h2>
              <button
                onClick={() => setShowAssignedGuides(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {assignedGuides.map((guide) => (
                <div
                  key={guide.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-red-500 transition cursor-pointer"
                  onClick={() => {
                    setShowAssignedGuides(false)
                    setSelectedGuide(guide)
                  }}
                >
                  <h3 className="text-lg font-semibold text-white mb-2">{guide.title}</h3>
                  <div className="text-slate-400 text-sm line-clamp-2">
                    {guide.content.substring(0, 150)}...
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Updated: {new Date(guide.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAssignedGuides(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-2">
            <BookOpen className="w-8 h-8" />
            <span>Guides & Handbooks</span>
          </h1>
          <p className="text-slate-400">Create and manage guides for your team</p>
        </div>
        {isEric && (
          <button
            onClick={() => {
              setEditingGuide(null)
              setFormData({ title: '', content: '', assignedTo: [] })
              setShowCreateModal(true)
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>Create Guide</span>
          </button>
        )}
      </div>

      {/* My Assigned Guides Section */}
      {assignedGuides.length > 0 && (
        <div className="mb-8 bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>My Guides ({assignedGuides.length})</span>
            </h2>
            <button
              onClick={() => setShowAssignedGuides(true)}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1"
            >
              <Eye className="w-4 h-4" />
              <span>View All</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedGuides.map((guide) => (
              <div
                key={guide.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-red-500 transition cursor-pointer"
                onClick={() => setSelectedGuide(guide)}
              >
                <h3 className="text-white font-semibold mb-2">{guide.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-2">
                  {guide.content.substring(0, 100)}...
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Updated: {new Date(guide.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Guides (Eric/Admin only) */}
      {isEric && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">All Guides</h2>
          {guides.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No guides created yet</p>
          ) : (
            <div className="space-y-4">
              {guides.map((guide) => (
                <div
                  key={guide.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">{guide.title}</h3>
                        {!guide.isActive && (
                          <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-sm mb-3 line-clamp-3">
                        {guide.content.substring(0, 200)}...
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                        <span>
                          Assigned to: {guide.assignedTo.length} user{guide.assignedTo.length !== 1 ? 's' : ''}
                        </span>
                        <span>Updated: {new Date(guide.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => toggleActive(guide)}
                        className="p-2 text-slate-400 hover:text-white transition"
                        title={guide.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {guide.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEditModal(guide)}
                        className="p-2 text-blue-400 hover:text-blue-300 transition"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(guide.id)}
                        className="p-2 text-red-400 hover:text-red-300 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingGuide) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                {editingGuide ? 'Edit Guide' : 'Create Guide'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingGuide(null)
                  setFormData({ title: '', content: '', assignedTo: [] })
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., How to Approve Releases"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Content *
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-slate-400 hover:text-slate-300 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
                <div className="mb-2 text-xs text-slate-500">
                  <p>• Paste image URLs or use markdown: <code className="bg-slate-800 px-1 rounded">![alt text](image-url)</code></p>
                  <p>• Links will automatically become clickable</p>
                </div>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter guide content, instructions, cheat sheet, etc...&#10;&#10;You can add images by:&#10;1. Uploading an image (button above)&#10;2. Using markdown: ![alt text](https://example.com/image.jpg)&#10;3. Pasting image URLs directly"
                  rows={12}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Assign To</span>
                </label>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {users.length === 0 ? (
                    <p className="text-slate-400 text-sm">No users found</p>
                  ) : (
                    <div className="space-y-2">
                      {users.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-slate-700/50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.assignedTo.includes(u.id)}
                            onChange={() => toggleUserAssignment(u.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-white text-sm">
                            {u.name} <span className="text-slate-500">({u.role})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={editingGuide ? handleUpdate : handleCreate}
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingGuide ? 'Update Guide' : 'Create Guide'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingGuide(null)
                    setFormData({ title: '', content: '', assignedTo: [] })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

