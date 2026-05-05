'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Edit, Eye, EyeOff, Circle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatTimeAgo } from '@/lib/utils'

interface User {
  id: string
  username: string
  name: string
  artistName?: string
  email: string
  role: 'artist' | 'manager' | 'admin'
  phoneNumber?: string
  createdAt: string
  createdFromCredit?: boolean
  ipi?: string
  linkedArtistIds?: string[]
  staffPermissions?: string[]
  staffManagedArtistIds?: string[]
}

function getRoleLabel(u: User): string {
  if (u.role === 'admin' && u.name?.toLowerCase().includes('eric')) return 'Owner'
  if (u.role === 'artist' && u.staffPermissions && u.staffPermissions.length > 0) return 'Staff'
  if (u.role === 'artist') return 'Artist'
  if (u.role === 'manager') return 'Manager'
  if (u.role === 'admin') return 'Owner'
  return u.role || 'User'
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [selectedUserForMapping, setSelectedUserForMapping] = useState<User | null>(null)
  const [mappingArtistName, setMappingArtistName] = useState('')
  const [artistMappings, setArtistMappings] = useState<Array<{id: string; artistName: string; userId: string}>>([])
  const [showManagerLinkModal, setShowManagerLinkModal] = useState(false)
  const [selectedManager, setSelectedManager] = useState<User | null>(null)
  const [selectedArtistId, setSelectedArtistId] = useState<string>('')

  // Staff permissions (Option B)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [selectedStaffUser, setSelectedStaffUser] = useState<User | null>(null)
  const [staffPermissions, setStaffPermissions] = useState<string[]>([])
  const [staffManagedArtistIds, setStaffManagedArtistIds] = useState<string[]>([])
  const [staffArtistSearch, setStaffArtistSearch] = useState('')

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phoneNumber: '',
    role: 'artist' as 'artist' | 'manager' | 'admin',
    defaultPassword: '',
  })

  useEffect(() => {
    fetchUsers()
    fetchArtistMappings()
    
    // Check if there's a userId query parameter to highlight
    const urlParams = new URLSearchParams(window.location.search)
    const userId = urlParams.get('userId')
    if (userId) {
      // Scroll to user after a short delay
      setTimeout(() => {
        const element = document.getElementById(`user-${userId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-slate-900')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-slate-900')
          }, 3000)
        }
      }, 500)
    }
  }, [])

  const openStaffModal = (target: User) => {
    setSelectedStaffUser(target)
    setStaffPermissions(Array.isArray(target.staffPermissions) ? target.staffPermissions : [])
    setStaffManagedArtistIds(Array.isArray(target.staffManagedArtistIds) ? target.staffManagedArtistIds : [])
    setStaffArtistSearch('')
    setShowStaffModal(true)
  }

  const saveStaffSettings = async () => {
    if (!selectedStaffUser) return
    if (!isAdmin || !currentUser?.id) {
      alert('Only admins can update staff permissions.')
      return
    }
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaffUser.id,
          actorUserId: currentUser.id,
          staffPermissions,
          staffManagedArtistIds,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowStaffModal(false)
        setSelectedStaffUser(null)
        fetchUsers()
        alert('Staff settings saved.')
      } else {
        alert(data.error || data.details || 'Failed to save staff settings')
      }
    } catch (error: any) {
      console.error('Failed to save staff settings:', error)
      alert(error.message || 'Failed to save staff settings')
    }
  }

  const fetchArtistMappings = async () => {
    try {
      const res = await fetch('/api/artist-mappings')
      const data = await res.json()
      if (data.success) {
        setArtistMappings(data.mappings || [])
      }
    } catch (error) {
      console.error('Failed to fetch artist mappings:', error)
    }
  }

  const handleAddMapping = async () => {
    if (!selectedUserForMapping || !mappingArtistName.trim()) {
      alert('Please select a user and enter an artist name')
      return
    }

    try {
      console.log('[handleAddMapping] Creating mapping:', {
        artistName: mappingArtistName.trim(),
        userId: selectedUserForMapping.id,
        userName: selectedUserForMapping.name,
      })

      const res = await fetch('/api/artist-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: mappingArtistName.trim(),
          userId: selectedUserForMapping.id,
        }),
      })

      const data = await res.json()
      console.log('[handleAddMapping] Response:', data)

      if (data.success) {
        setShowMappingModal(false)
        setMappingArtistName('')
        setSelectedUserForMapping(null)
        fetchArtistMappings()
        // Trigger catalog re-linking
        fetch('/api/catalog?autoLink=true').catch(() => {})
        alert(`Successfully mapped "${mappingArtistName.trim()}" to ${selectedUserForMapping.name}`)
      } else {
        const errorMsg = data.error || data.details || 'Failed to create mapping'
        console.error('[handleAddMapping] Error response:', data)
        alert(`Error: ${errorMsg}${data.received ? `\n\nReceived: ${JSON.stringify(data.received)}` : ''}`)
      }
    } catch (error: any) {
      console.error('[handleAddMapping] Exception:', error)
      alert(`Failed to create mapping: ${error.message || 'Unknown error'}\n\nCheck the browser console for details.`)
    }
  }

  const handleDeleteMapping = async (artistName: string) => {
    if (!confirm(`Remove mapping for "${artistName}"?`)) return

    try {
      const res = await fetch('/api/artist-mappings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistName }),
      })

      const data = await res.json()
      if (data.success) {
        fetchArtistMappings()
      } else {
        alert(data.error || 'Failed to delete mapping')
      }
    } catch (error) {
      console.error('Failed to delete mapping:', error)
      alert('Failed to delete mapping')
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
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        // When editing, only send fields that have changed or are being set
        const updates: any = { id: editingUser.id }
        
        // Only include fields that are different from current values or are being explicitly set
        if (formData.username !== editingUser.username) updates.username = formData.username
        if (formData.name !== editingUser.name) updates.name = formData.name
        if (formData.email !== editingUser.email) updates.email = formData.email
        if (formData.phoneNumber !== (editingUser.phoneNumber || '')) {
          updates.phoneNumber = formData.phoneNumber || undefined // Convert empty string to undefined
        }
        if (formData.role !== editingUser.role) updates.role = formData.role
        // Only update password if a new one was provided
        if (formData.password && formData.password.trim()) {
          updates.password = formData.password
        }
        
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        const data = await res.json()
        if (data.success) {
          setShowAddModal(false)
          setEditingUser(null)
          setFormData({ username: '', password: '', name: '', email: '', phoneNumber: '', role: 'artist', defaultPassword: '' })
          fetchUsers()
        } else {
          alert(data.error || 'Failed to update user')
        }
      } else {
        // Creating new user - send all required fields
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        const data = await res.json()
        if (data.success) {
          setShowAddModal(false)
          setEditingUser(null)
          setFormData({ username: '', password: '', name: '', email: '', phoneNumber: '', role: 'artist', defaultPassword: '' })
          fetchUsers()
        } else {
          alert(data.error || 'Failed to create user')
        }
      }
    } catch (error: any) {
      console.error('Failed to save user:', error)
      alert(error.message || 'Failed to save user')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">Manage user accounts and credentials</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null)
            setFormData({ username: '', password: '', name: '', email: '', phoneNumber: '', role: 'artist', defaultPassword: '' })
            setShowAddModal(true)
          }}
          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          <span>Add User</span>
        </button>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Username</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Phone</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Last Active</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Password</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const urlParams = new URLSearchParams(window.location.search)
                const highlightUserId = urlParams.get('userId')
                const isHighlighted = highlightUserId === user.id
                
                return (
                <tr 
                  key={user.id} 
                  id={`user-${user.id}`}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${isHighlighted ? 'bg-blue-500/20 ring-2 ring-blue-500' : ''}`}
                >
                  <td className="py-3 px-4 text-white font-medium">{user.username}</td>
                  <td className="py-3 px-4 text-slate-400">
                    <div className="flex items-center space-x-2">
                      <span>{user.name}</span>
                      {user.createdFromCredit && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs" title="Created from credit">
                          From Credit
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{user.email}</td>
                  <td className="py-3 px-4 text-slate-400">{user.phoneNumber || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs capitalize">
                          {getRoleLabel(user)}
                        </span>
                        {user.ipi && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs" title="IPI Number">
                            IPI: {user.ipi}
                          </span>
                        )}
                      </div>
                      {/* Show artist name mappings for this user */}
                      {artistMappings.filter(m => m.userId === user.id).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {artistMappings.filter(m => m.userId === user.id).map(mapping => (
                            <span 
                              key={mapping.id}
                              className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs"
                              title="Mapped artist name"
                            >
                              {mapping.artistName}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Show staff permissions badge for artists with staff access */}
                      {user.role === 'artist' && user.staffPermissions && user.staffPermissions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span 
                            className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold"
                            title={`Staff permissions: ${user.staffPermissions.join(', ')}`}
                          >
                            ⚡ Staff Access
                          </span>
                          {user.staffManagedArtistIds && user.staffManagedArtistIds.length > 0 && (
                            <span 
                              className="px-2 py-0.5 bg-yellow-500/10 text-yellow-300 rounded text-xs"
                              title={`Manages ${user.staffManagedArtistIds.length} artist(s)`}
                            >
                              {user.staffManagedArtistIds.length} artist{user.staffManagedArtistIds.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Show linked artists for managers */}
                      {user.role === 'manager' && user.linkedArtistIds && user.linkedArtistIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.linkedArtistIds.map(artistId => {
                            const artist = users.find(u => u.id === artistId)
                            if (!artist) return null
                            return (
                              <span 
                                key={artistId}
                                className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs"
                                title="Linked artist"
                              >
                                {artist.artistName || artist.name}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {(user as any).lastActive ? (
                      <div className="flex items-center space-x-2">
                        <Circle 
                          className={`w-2 h-2 ${
                            Date.now() - new Date((user as any).lastActive).getTime() < 5 * 60 * 1000
                              ? 'text-green-400 fill-green-400' 
                              : 'text-slate-500 fill-slate-500'
                          }`}
                        />
                        <span className="text-slate-400 text-sm">
                          {Date.now() - new Date((user as any).lastActive).getTime() < 5 * 60 * 1000
                            ? 'Active now'
                            : formatTimeAgo((user as any).lastActive)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">Never</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          if (!showPasswords[user.id]) {
                            try {
                              const res = await fetch(`/api/users/${user.id}/password`)
                              const data = await res.json()
                              if (data.success) {
                                setPasswords({ ...passwords, [user.id]: data.password })
                                setShowPasswords({ ...showPasswords, [user.id]: true })
                              }
                            } catch (error) {
                              console.error('Failed to fetch password:', error)
                            }
                          } else {
                            setShowPasswords({ ...showPasswords, [user.id]: false })
                          }
                        }}
                        className="text-slate-500 hover:text-red-400 flex items-center space-x-2"
                      >
                        {showPasswords[user.id] ? (
                          <>
                            <span className="text-slate-400 font-mono text-sm">{passwords[user.id] || '••••••••'}</span>
                            <EyeOff className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400 font-mono text-sm">••••••••</span>
                            <Eye className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {/* Artist name mapping button (for artists) */}
                      {user.role === 'artist' && (
                        <button
                          onClick={() => {
                            setSelectedUserForMapping(user)
                            setMappingArtistName('')
                            setShowMappingModal(true)
                          }}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                          title="Map artist name to this account"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      {/* Link artists button (for managers) */}
                      {user.role === 'manager' && (
                        <button
                          onClick={() => {
                            setSelectedManager(user)
                            setSelectedArtistId('')
                            setShowManagerLinkModal(true)
                          }}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition"
                          title="Link artists to this manager"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      {/* Staff permissions button (for artists) - admin only */}
                      {isAdmin && user.role === 'artist' && (
                        <button
                          onClick={() => openStaffModal(user)}
                          className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded transition"
                          title="Staff access (scoped)"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          setFormData({
                            username: user.username,
                            password: '',
                            name: user.name,
                            email: user.email,
                            phoneNumber: user.phoneNumber || '',
                            role: user.role,
                            defaultPassword: '',
                          })
                          setShowAddModal(true)
                        }}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full my-auto max-h-[95vh] flex flex-col">
            <div className="p-4 sm:p-6 pb-4 flex-shrink-0 border-b border-slate-800">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Full name (shown in sidebar)"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Default Password *'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    const pwd = e.target.value
                    setFormData({ ...formData, password: pwd, defaultPassword: pwd })
                  }}
                  required={!editingUser}
                  placeholder={editingUser ? 'Enter new password' : 'Will be changeable on first login'}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {!editingUser && formData.password && (
                  <p className="text-xs text-slate-500 mt-1">Default password: {formData.password}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number (for AI)</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-slate-500 mt-1">Format: +1234567890 (for iMessage notifications)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="artist">Artist</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              </div>
              {/* Fixed footer with buttons */}
              <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-slate-800 flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingUser(null)
                    setFormData({ username: '', password: '', name: '', email: '', phoneNumber: '', role: 'artist', defaultPassword: '' })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Artist Name Mapping Modal */}
      {showMappingModal && selectedUserForMapping && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Map Artist Name</h2>
            <p className="text-slate-400 mb-4">
              Link an artist name to <span className="text-white font-semibold">{selectedUserForMapping.name}</span>'s account.
              Names are cosmetic - only mappings connect catalog items to accounts.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Artist Name (as it appears in catalog)
                </label>
                <input
                  type="text"
                  value={mappingArtistName}
                  onChange={(e) => setMappingArtistName(e.target.value)}
                  placeholder="e.g., Zion Johnson, 555wick, etc."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">
                  Example: Map "Zion Johnson" to connect all songs with that name to this account
                </p>
              </div>

              {/* Show existing mappings for this user */}
              {artistMappings.filter(m => m.userId === selectedUserForMapping.id).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Existing Mappings
                  </label>
                  <div className="space-y-2">
                    {artistMappings.filter(m => m.userId === selectedUserForMapping.id).map(mapping => (
                      <div key={mapping.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                        <span className="text-slate-300">{mapping.artistName}</span>
                        <button
                          onClick={() => handleDeleteMapping(mapping.artistName)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleAddMapping}
                disabled={!mappingArtistName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Add Mapping
              </button>
              <button
                onClick={() => {
                  setShowMappingModal(false)
                  setMappingArtistName('')
                  setSelectedUserForMapping(null)
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Permissions (Scoped) Modal */}
      {showStaffModal && selectedStaffUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-2">Staff Access (Scoped)</h2>
            <p className="text-slate-400 mb-4">
              Grant <span className="text-white font-semibold">{selectedStaffUser.artistName || selectedStaffUser.name}</span> staff tools
              for specific artists. Staff users are <span className="text-white font-semibold">always blocked</span> from approving/editing their own releases.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-200 mb-3">Permissions</p>
                <label className="flex items-center gap-3 text-slate-200 mb-2">
                  <input
                    type="checkbox"
                    checked={staffPermissions.includes('staff:catalog:write')}
                    onChange={(e) => {
                      setStaffPermissions(prev =>
                        e.target.checked
                          ? Array.from(new Set([...prev, 'staff:catalog:write']))
                          : prev.filter(p => p !== 'staff:catalog:write')
                      )
                    }}
                  />
                  <span>Catalog edit (add/update/delete)</span>
                </label>
                <label className="flex items-center gap-3 text-slate-200">
                  <input
                    type="checkbox"
                    checked={staffPermissions.includes('staff:releases:approve')}
                    onChange={(e) => {
                      setStaffPermissions(prev =>
                        e.target.checked
                          ? Array.from(new Set([...prev, 'staff:releases:approve']))
                          : prev.filter(p => p !== 'staff:releases:approve')
                      )
                    }}
                  />
                  <span>Approve / deny releases</span>
                </label>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-200 mb-2">Managed Artists</p>
                <input
                  value={staffArtistSearch}
                  onChange={(e) => setStaffArtistSearch(e.target.value)}
                  placeholder="Search artists..."
                  className="w-full px-3 py-2 mb-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {users
                    .filter(u => u.role === 'artist')
                    .filter(u => u.id !== selectedStaffUser.id)
                    .filter(u => {
                      const q = staffArtistSearch.trim().toLowerCase()
                      if (!q) return true
                      const label = (u.artistName || u.name || '').toLowerCase()
                      return label.includes(q)
                    })
                    .map(artist => (
                      <label key={artist.id} className="flex items-center gap-3 text-slate-200">
                        <input
                          type="checkbox"
                          checked={staffManagedArtistIds.includes(artist.id)}
                          onChange={(e) => {
                            setStaffManagedArtistIds(prev =>
                              e.target.checked
                                ? Array.from(new Set([...prev, artist.id]))
                                : prev.filter(id => id !== artist.id)
                            )
                          }}
                        />
                        <span>{artist.artistName || artist.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={saveStaffSettings}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Save Staff Settings
              </button>
              <button
                onClick={() => {
                  setShowStaffModal(false)
                  setSelectedStaffUser(null)
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Link Artists Modal */}
      {showManagerLinkModal && selectedManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Link Artists to Manager</h2>
            <p className="text-slate-400 mb-4">
              Link artists to <span className="text-white font-semibold">{selectedManager.name}</span> so they can view their artists' data.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Artist to Link
                </label>
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select an artist...</option>
                  {users.filter(u => u.role === 'artist').map(artist => (
                    <option key={artist.id} value={artist.id}>
                      {artist.artistName || artist.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show currently linked artists */}
              {selectedManager.linkedArtistIds && selectedManager.linkedArtistIds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Currently Linked Artists
                  </label>
                  <div className="space-y-2">
                    {selectedManager.linkedArtistIds.map(artistId => {
                      const artist = users.find(u => u.id === artistId)
                      if (!artist) return null
                      return (
                        <div key={artistId} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                          <span className="text-slate-300">{artist.artistName || artist.name}</span>
                          <button
                            onClick={async () => {
                              const currentLinked = selectedManager.linkedArtistIds || []
                              const updatedLinked = currentLinked.filter(id => id !== artistId)
                              try {
                                const res = await fetch('/api/users', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: selectedManager.id,
                                    linkedArtistIds: updatedLinked,
                                  }),
                                })
                                const data = await res.json()
                                if (data.success) {
                                  fetchUsers()
                                  setSelectedManager({ ...selectedManager, linkedArtistIds: updatedLinked })
                                } else {
                                  alert(data.error || 'Failed to unlink artist')
                                }
                              } catch (error) {
                                console.error('Failed to unlink artist:', error)
                                alert('Failed to unlink artist')
                              }
                            }}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  if (!selectedArtistId) {
                    alert('Please select an artist')
                    return
                  }
                  
                  const currentLinked = selectedManager.linkedArtistIds || []
                  if (currentLinked.includes(selectedArtistId)) {
                    alert('This artist is already linked')
                    return
                  }
                  
                  const updatedLinked = [...currentLinked, selectedArtistId]
                  
                  try {
                    const res = await fetch('/api/users', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: selectedManager.id,
                        linkedArtistIds: updatedLinked,
                      }),
                    })
                    
                    const data = await res.json()
                    if (data.success) {
                      fetchUsers()
                      setSelectedManager({ ...selectedManager, linkedArtistIds: updatedLinked })
                      setSelectedArtistId('')
                      alert(`Successfully linked artist to ${selectedManager.name}`)
                    } else {
                      alert(data.error || 'Failed to link artist')
                    }
                  } catch (error) {
                    console.error('Failed to link artist:', error)
                    alert('Failed to link artist')
                  }
                }}
                disabled={!selectedArtistId}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Link Artist
              </button>
              <button
                onClick={() => {
                  setShowManagerLinkModal(false)
                  setSelectedManager(null)
                  setSelectedArtistId('')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

