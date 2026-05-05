'use client'

import { useState, useRef, useEffect } from 'react'

// Set to true to show the chat button again
const CHAT_VISIBLE = false

import { X, Send, MessageCircle, Minimize2, Maximize2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp: Date
}

export default function SupportChatPopup() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'support',
      content: "Hello! I'm here to help. Send a message and our support team will respond to you via iMessage.",
      timestamp: new Date(),
    },
  ])
  const [needsPhoneNumber, setNeedsPhoneNumber] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null) // Store questionId for idempotency
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, isMinimized])

  const getQuestionId = () => {
    if (currentQuestionId) return currentQuestionId
    const randomSuffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10)
    const nextId = user?.id ? `support_${user.id}_${Date.now()}` : `support_${Date.now()}_${randomSuffix}`
    setCurrentQuestionId(nextId)
    return nextId
  }

  const handleSend = async () => {
    const textToSend = input.trim()
    if (!textToSend || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Generate or reuse questionId for idempotency
      const questionId = getQuestionId()
      
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          userId: user?.id,
          userName: user?.name,
          userRole: user?.role,
          artistName: user?.artistName || user?.name,
          questionId: questionId, // Include stable questionId for idempotency
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.error || errorData.details || `Server error (${res.status})`
        console.error('Support chat API error:', errorMsg)
        throw new Error(errorMsg)
      }

      const data = await res.json()
      
      if (data.needsPhoneNumber) {
        // User needs to provide phone number - store the message to resend later
        setPendingMessage(textToSend)
        setNeedsPhoneNumber(true)
        const phoneRequestMessage: Message = {
          role: 'support',
          content: 'To send you support messages via iMessage, I need your phone number. What\'s your phone number?',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, phoneRequestMessage])
        return
      }
      
      if (data.success) {
        // Show confirmation message
        const supportMessage: Message = {
          role: 'support',
          content: data.response || 'Check your messages. We\'re sending you a text.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, supportMessage])
        setNeedsPhoneNumber(false)
        setPhoneInput('')
        setPendingMessage(null)
        // IMPORTANT: after a successful send, clear so the next message gets a new questionId.
        setCurrentQuestionId(null)
      } else {
        const errorMsg = data.error || data.details || 'Failed to get response'
        console.error('Support chat response error:', errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      console.error('Support chat error:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      })
      
      // Show more helpful error message
      let errorMessage = 'Sorry, I encountered an error. Please try again or contact support directly.'
      
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed') || error.message?.includes('Support server unavailable')) {
        errorMessage = '⚠️ Support server is not currently running.\n\nTo use support chat:\n1. Start your message AI server on port 3001\n2. Ensure it has the /api/support-question endpoint\n3. Try sending your message again\n\nYour message was not sent. Please contact support directly or try again once the server is running.'
      } else if (error.message?.includes('Support server unavailable')) {
        errorMessage = error.message
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`
      }
      
      const errorMsg: Message = {
        role: 'support',
        content: errorMessage,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (needsPhoneNumber) {
        handlePhoneSubmit()
      } else {
        handleSend()
      }
    }
  }

  const handlePhoneSubmit = async () => {
    const phone = phoneInput.trim()
    if (!phone || isLoading) return

    // Basic phone number validation
    if (!/^[\d\s\-\+\(\)]+$/.test(phone) || phone.replace(/\D/g, '').length < 10) {
      const errorMessage: Message = {
        role: 'support',
        content: 'Please enter a valid phone number (e.g., +1234567890 or (123) 456-7890)',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      return
    }

    setIsLoading(true)
    
    // Send the phone number to save it and resend the pending message
    try {
      const messageToSend = pendingMessage || messages.filter(m => m.role === 'user').pop()?.content || 'Support request'
      
      // Reuse the same questionId for idempotency when resending after phone number collection
      const questionId = getQuestionId()
      
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          userId: user?.id,
          userName: user?.name,
          userRole: user?.role,
          artistName: user?.artistName || user?.name,
          phoneNumber: phone,
          questionId: questionId, // Include stable questionId for idempotency
        }),
      })

      const data = await res.json()
      
      if (data.success) {
        const phoneSavedMessage: Message = {
          role: 'user',
          content: `Phone: ${phone}`,
          timestamp: new Date(),
        }
        const supportMessage: Message = {
          role: 'support',
          content: data.response || 'Check your messages. We\'re sending you a text.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, phoneSavedMessage, supportMessage])
        setNeedsPhoneNumber(false)
        setPhoneInput('')
        setPendingMessage(null)
        setCurrentQuestionId(null) // Reset after successful send
      } else {
        throw new Error(data.error || 'Failed to save phone number')
      }
    } catch (error: any) {
      console.error('Phone number save error:', error)
      const errorMessage: Message = {
        role: 'support',
        content: `Error saving phone number: ${error.message || 'Please try again'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  if (!CHAT_VISIBLE) return null

  return (
    <>
      {/* Floating Chat Button - Hidden on mobile */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true)
            setIsMinimized(false)
          }}
          className="hidden lg:flex fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 group"
          aria-label="Open support chat"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-red-600 animate-pulse"></span>
        </button>
      )}

      {/* Chat Popup - Hidden on mobile */}
      {isOpen && (
        <div
          className={`hidden lg:flex fixed bottom-6 right-6 z-50 transition-all duration-300 ${
            isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="w-full h-full rounded-2xl border border-white/20 shadow-2xl flex flex-col overflow-hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600/80 to-red-700/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-white" />
                <h3 className="text-white font-semibold text-sm">Support Chat</h3>
                <span className="text-xs text-white/80">({user.name})</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white/80 hover:text-white transition p-1 hover:bg-white/10 rounded"
                  aria-label={isMinimized ? 'Maximize' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setIsMinimized(false)
                    setNeedsPhoneNumber(false)
                    setPhoneInput('')
                    setPendingMessage(null)
                    setCurrentQuestionId(null)
                  }}
                  className="text-white/80 hover:text-white transition p-1 hover:bg-white/10 rounded"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-red-600/80 text-white'
                            : 'bg-white/10 text-white border border-white/20'
                        }`}
                        style={{
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                        }}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <p className="text-xs mt-1 opacity-70">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div
                        className="bg-white/10 text-white border border-white/20 rounded-2xl px-4 py-2"
                        style={{
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                        }}
                      >
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-white/10 bg-black/30 p-4">
                  {needsPhoneNumber ? (
                    <div className="space-y-2">
                      <p className="text-xs text-white/70 mb-2">Enter your phone number to receive support via iMessage</p>
                      <div className="flex items-center space-x-2">
                        <input
                          ref={inputRef}
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="+1234567890 or (123) 456-7890"
                          disabled={isLoading}
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition"
                          style={{
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                          }}
                        />
                        <button
                          onClick={handlePhoneSubmit}
                          disabled={!phoneInput.trim() || isLoading}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl p-2 transition"
                        >
                          {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        disabled={isLoading}
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition"
                        style={{
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                        }}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl p-2 transition"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
