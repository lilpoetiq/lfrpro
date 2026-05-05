'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MessageSquare, Send, Plus, Music } from 'lucide-react'

interface Message {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  subject: string
  message: string
  songId?: string
  read: boolean
  createdAt: string
}

interface User {
  id: string
  name: string
  role: string
}

interface CatalogItem {
  id: string
  song: string
  artist: string
}

export default function CommunicationPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [formData, setFormData] = useState({
    to: '',
    toName: '',
    subject: '',
    message: '',
    songId: '',
  })

  useEffect(() => {
    fetchData()
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchUsers()
      fetchCatalog()
    }
  }, [user])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/messages?userId=${user?.id}`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages.sort((a: Message, b: Message) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ))
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent artists from sending messages
    if (user?.role === 'artist') {
      alert('Artists cannot send messages')
      return
    }
    
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          from: user?.id || '',
          fromName: user?.name || '',
          songId: formData.songId || undefined,
          userRole: user?.role,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowComposeModal(false)
        setFormData({ to: '', toName: '', subject: '', message: '', songId: '' })
        fetchData()
      } else {
        alert(data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchData()
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const unreadCount = messages.filter(m => !m.read && m.to === user?.id).length

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
          <h1 className="text-3xl font-bold text-white mb-2">Communication</h1>
          <p className="text-slate-400">
            {unreadCount > 0 && (
              <span className="text-red-400">{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</span>
            )}
            {unreadCount === 0 && 'Team messages and updates'}
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => {
              setSelectedMessage(null)
              setFormData({ to: '', toName: '', subject: '', message: '', songId: '' })
              setShowComposeModal(true)
            }}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>New Message</span>
          </button>
        )}
      </div>

      {/* Messages List */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Messages</h2>
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  setSelectedMessage(msg)
                  if (!msg.read && msg.to === user?.id) {
                    handleMarkRead(msg.id)
                  }
                }}
                className={`p-4 rounded-lg border cursor-pointer transition ${
                  !msg.read && msg.to === user?.id
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-white">{msg.subject}</h3>
                      {!msg.read && msg.to === user?.id && (
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-1">
                      {msg.to === user?.id ? `From: ${msg.fromName}` : `To: ${msg.toName}`}
                    </p>
                    {msg.songId && (
                      <div className="flex items-center space-x-1 text-xs text-red-400 mb-1">
                        <Music className="w-3 h-3" />
                        <span>Related to song</span>
                      </div>
                    )}
                    <p className="text-sm text-slate-300 line-clamp-2">{msg.message}</p>
                  </div>
                  <span className="text-xs text-slate-500 ml-4">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedMessage.subject}</h2>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400">From</p>
                <p className="text-white">{selectedMessage.fromName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">To</p>
                <p className="text-white">{selectedMessage.toName}</p>
              </div>
              {selectedMessage.songId && (
                <div>
                  <p className="text-sm text-slate-400">Related Song</p>
                  <p className="text-red-400">{catalog.find(c => c.id === selectedMessage.songId)?.song || 'Unknown'}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-400 mb-2">Message</p>
                <p className="text-white whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {new Date(selectedMessage.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Compose Message</h2>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">To</label>
                <select
                  value={formData.to && users.some(u => u.id === formData.to) ? formData.to : ''}
                  onChange={(e) => {
                    const selected = users.find(u => u.id === e.target.value)
                    setFormData({ ...formData, to: e.target.value, toName: selected?.name || '' })
                  }}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select recipient...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                {formData.to && !users.some(u => u.id === formData.to) && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Selected recipient not found. Please select a recipient from the list.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Related Song (Optional)</label>
                <select
                  value={formData.songId}
                  onChange={(e) => setFormData({ ...formData, songId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">None</option>
                  {catalog.map(item => (
                    <option key={item.id} value={item.id}>{item.song} - {item.artist}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowComposeModal(false)
                    setFormData({ to: '', toName: '', subject: '', message: '', songId: '' })
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
    </div>
  )
}

