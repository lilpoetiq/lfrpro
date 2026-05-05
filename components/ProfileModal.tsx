'use client'

import { useState, useEffect } from 'react'
import { X, User, Mail, Phone, Lock, Lightbulb } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUserProfile } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [featureRequest, setFeatureRequest] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      setPhoneNumber(user.phoneNumber || '')
      setEmail(user.email || '')
      setFeatureRequest('')
      setMessage(null)
    }
  }, [isOpen, user])

  const handleSaveProfile = async () => {
    if (!user?.id) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phoneNumber: phoneNumber.trim() || undefined,
          email: email.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success && data.user) {
        updateUserProfile(data.user)
        setMessage({ type: 'success', text: 'Profile updated' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to update' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!user?.id || !passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      setMessage({ type: 'error', text: 'Fill all password fields' })
      return
    }
    if (passwordForm.new.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed' })
        setPasswordForm({ current: '', new: '', confirm: '' })
        setShowPassword(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitFeatureRequest = async () => {
    if (!user?.id || !featureRequest.trim()) {
      setMessage({ type: 'error', text: 'Enter a suggestion' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          message: featureRequest.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Request submitted. Thanks!' })
        setFeatureRequest('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to submit' })
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            Account & Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Profile */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Profile</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <div className="flex gap-2">
                  <Mail className="w-4 h-4 text-slate-500 mt-2.5 flex-shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Phone</label>
                <div className="flex gap-2">
                  <Phone className="w-4 h-4 text-slate-500 mt-2.5 flex-shrink-0" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                Save profile
              </button>
            </div>
          </section>

          {/* Password */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Change password
            </h3>
            {!showPassword ? (
              <button
                onClick={() => setShowPassword(true)}
                className="w-full py-2 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 rounded-lg text-sm transition"
              >
                Change password
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  placeholder="Current password"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  placeholder="New password (min 6)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowPassword(false); setPasswordForm({ current: '', new: '', confirm: '' }) }}
                    className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={saving}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                  >
                    Update password
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Feature requests */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Suggest a feature
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              Request something you&apos;d like added to the site.
            </p>
            <textarea
              value={featureRequest}
              onChange={(e) => setFeatureRequest(e.target.value)}
              placeholder="e.g. Add dark mode toggle, export catalog to CSV..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none"
            />
            <button
              onClick={handleSubmitFeatureRequest}
              disabled={saving || !featureRequest.trim()}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition mt-2"
            >
              Submit request
            </button>
          </section>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
