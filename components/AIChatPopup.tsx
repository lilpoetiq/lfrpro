'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2, History, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import NotificationPermissionPopup from '@/components/NotificationPermissionPopup'
import { checkNotificationSupport } from '@/lib/notifications'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  messageCount: number
}

export default function AIChatPopup() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey! I'm your Legendary Fyre Records AI assistant. I can help you with insights about your music, streaming data, release scheduling, and give you advice on how to improve your releases. What would you like to know?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const [notificationContext, setNotificationContext] = useState<string>('')
  const [adminPassword, setAdminPassword] = useState<string>('')
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  // Load admin password from localStorage
  useEffect(() => {
    const savedPassword = localStorage.getItem('ai_admin_password')
    if (savedPassword) {
      setAdminPassword(savedPassword)
    }
  }, [])

  // Listen for openAIChat events from notifications
  useEffect(() => {
    const handleOpenAIChat = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail?.prompt) {
        setIsOpen(true)
        // Wait for chat to open, then send the prompt
        setTimeout(() => {
          const textToSend = customEvent.detail.prompt
          if (!textToSend || isLoading) return

          const userMessage: Message = {
            role: 'user',
            content: textToSend,
            timestamp: new Date(),
          }

          setMessages((prev) => [...prev, userMessage])
          setIsLoading(true)

          fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: textToSend,
              conversationHistory: messages.map(m => ({
                role: m.role,
                content: m.content,
              })),
              userId: user?.id,
              userName: user?.name,
              userRole: user?.role,
            }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: data.response,
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, assistantMessage])
              } else {
                const errorMessage: Message = {
                  role: 'assistant',
                  content: 'Sorry, I encountered an error. Please try again.',
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, errorMessage])
              }
            })
            .catch(error => {
              console.error('Chat error:', error)
              const errorMessage: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
              }
              setMessages((prev) => [...prev, errorMessage])
            })
            .finally(() => {
              setIsLoading(false)
            })
        }, 300)
      }
    }

    window.addEventListener('openAIChat', handleOpenAIChat)
    return () => {
      window.removeEventListener('openAIChat', handleOpenAIChat)
    }
  }, [messages, isLoading, user])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      // Load chat history when chat opens
      if (user?.id) {
        loadChatHistory()
      }
    }
  }, [isOpen, user?.id])


  const loadChatHistory = async () => {
    try {
      const res = await fetch(`/api/ai-chat/history?userId=${user?.id}`)
      const data = await res.json()
      if (data.success && data.history) {
        // Convert stored messages to Message format
        // Load ALL messages - no limit, all chats are saved forever
        const loadedMessages: Message[] = data.history.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }))
        
        if (loadedMessages.length > 0) {
          // Show all messages, sorted by timestamp
          setMessages(loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()))
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const loadConversationHistory = async () => {
    try {
      const res = await fetch(`/api/ai-chat/conversations?userId=${user?.id}`)
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  useEffect(() => {
    if (showHistory && user?.id) {
      loadConversationHistory()
    }
  }, [showHistory, user?.id])

  const handleSendWithPrompt = async (promptText?: string) => {
    const textToSend = promptText || input.trim()
    if (!textToSend || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    if (!promptText) {
      setInput('')
    } else {
      setInput('') // Clear input even for prompts
    }
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          userId: user?.id,
          userName: user?.name,
          userRole: user?.role,
          adminPassword: user?.role !== 'admin' && adminPassword ? adminPassword : undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage: Message = {
          role: 'assistant',
          content: errorData.error || `Sorry, I encountered an error (${res.status}). Please try again.`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
        return
      }

      const data = await res.json()

      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        
        // Check if a notification was sent (to admin or artist)
        if (data.messageRelayed || data.releaseRequested || data.messageSentToArtist || data.notificationCreated) {
          // Check if notifications are not enabled
          if (checkNotificationSupport() && Notification.permission !== 'granted') {
            const hasBeenAsked = localStorage.getItem('notificationPermissionAsked')
            if (!hasBeenAsked || Notification.permission === 'default') {
              let contextMessage = ''
              if (data.messageRelayed) {
                contextMessage = 'You just received a message from an artist via AI chat. Enable notifications to get notified about new messages even when the app is closed.'
              } else if (data.messageSentToArtist) {
                contextMessage = 'You just sent a message to an artist through AI. Enable notifications to get notified when they respond, even when the app is closed.'
              } else if (data.releaseRequested) {
                contextMessage = 'You just received a release request notification. Enable notifications to stay updated on release approvals and important updates.'
              } else if (data.notificationCreated) {
                if (data.aiRedirected) {
                  contextMessage = 'The AI redirected a conversation back to music/label topics. A notification was sent to admin. Enable notifications to stay updated on AI interactions.'
                } else if (data.aiError) {
                  contextMessage = 'The AI encountered an issue. A notification was sent to admin. Enable notifications to stay updated on AI problems.'
                } else {
                  contextMessage = 'A notification was created. Enable notifications to stay updated on important AI interactions.'
                }
              }
              
              if (contextMessage) {
                setNotificationContext(contextMessage)
                setShowNotificationPrompt(true)
              }
            }
          }
        }
        
        // Show user feedback for AI redirects/errors
        if (data.aiRedirected || data.aiError) {
          // The notification was already created, just inform the user
          console.log('AI interaction notification created:', { aiRedirected: data.aiRedirected, aiError: data.aiError })
        }
      } else {
        // Check if it's an AI server unavailable error
        const isServerUnavailable = data.error?.includes('AI server unavailable') || 
                                     data.error?.includes('not running') ||
                                     data.error?.includes('port 3001')
        
        const errorMessage: Message = {
          role: 'assistant',
          content: isServerUnavailable 
            ? `⚠️ **AI Server Unavailable**\n\nThe message AI server is not currently running. To use AI chat features:\n\n1. **Start the AI server** on port 3001\n2. **Or configure a custom URL** by setting the \`AI_SERVER_URL\` environment variable\n\nOther dashboard features will continue to work normally.`
            : data.error || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    await handleSendWithPrompt()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Button - Desktop Only */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="hidden lg:flex fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 items-center space-x-2"
          title="Ask Legendary Fyre Records AI"
        >
          <Bot className="w-6 h-6" />
          <span>Legendary Fyre Records AI</span>
        </button>
      )}

      {/* Conversation History Sidebar */}
      {isOpen && showHistory && (
        <div className="fixed inset-0 sm:inset-auto bottom-6 right-[28rem] z-40 w-full sm:w-80 h-full sm:h-[600px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700 bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-white font-semibold">All Conversations</h4>
                <p className="text-xs text-slate-400 mt-1">Every chat is saved forever</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => {
                setMessages([{
                  role: 'assistant',
                  content: "Hey! I'm your Legendary Fyre Records AI assistant. I can help you with insights about your music, streaming data, release scheduling, and give you advice on how to improve your releases. What would you like to know?",
                  timestamp: new Date(),
                }])
                setShowHistory(false)
              }}
              className="w-full text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition"
            >
              Start New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No past conversations</p>
                <p className="text-xs text-slate-500 mt-1">Start chatting to see your history here</p>
              </div>
            ) : (
              <>
                <div className="mb-2 px-2">
                  <p className="text-xs text-slate-400 font-medium">
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} total
                  </p>
                </div>
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/ai-chat/history?userId=${user?.id}&conversationId=${conv.id}`)
                        const data = await res.json()
                        if (data.success && data.messages) {
                          const loadedMessages: Message[] = data.messages.map((msg: any) => ({
                            role: msg.role,
                            content: msg.content,
                            timestamp: new Date(msg.timestamp),
                          }))
                          setMessages(loadedMessages)
                          setShowHistory(false)
                        }
                      } catch (error) {
                        console.error('Failed to load conversation:', error)
                      }
                    }}
                    className="w-full text-left p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition border border-slate-700/50 hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm text-white font-medium truncate flex-1">{conv.title}</p>
                      <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                        {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{conv.lastMessage}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <p className="text-xs text-slate-500">
                        {new Date(conv.timestamp).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: new Date(conv.timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        })}
                        {' • '}
                        {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat Popup */}
      {isOpen && (
        <div className={`fixed inset-0 sm:inset-auto bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-full sm:max-w-md h-full sm:h-[600px] bg-slate-900 border border-slate-800 rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col ${showHistory ? 'sm:mr-64' : ''} transition-all`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Legendary Fyre Records AI Assistant</h3>
                <p className="text-xs text-red-100">Ask me about your music & insights</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setShowHistory(!showHistory)
                  if (!showHistory) {
                    loadConversationHistory()
                  }
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                title="View conversation history"
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-100 rounded-lg p-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-800">
            {user?.role !== 'admin' && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="admin-password" className="text-xs text-slate-400">
                    Admin Override Password (optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="text-xs text-slate-500 hover:text-slate-400"
                  >
                    {showAdminPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="admin-password"
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => {
                    const newPassword = e.target.value
                    setAdminPassword(newPassword)
                    if (newPassword) {
                      localStorage.setItem('ai_admin_password', newPassword)
                    } else {
                      localStorage.removeItem('ai_admin_password')
                    }
                  }}
                  placeholder="Enter admin password to use admin features"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use your admin password to access admin features while logged in as this account
                </p>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your music, insights, or how to improve..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              💡 Ask about streaming data, release strategies, or artist growth tips
            </p>
          </div>
        </div>
      )}

      {/* Notification Permission Prompt */}
      <NotificationPermissionPopup
        trigger={showNotificationPrompt}
        context={notificationContext}
        onClose={() => {
          setShowNotificationPrompt(false)
          setNotificationContext('')
        }}
      />
    </>
  )
}

