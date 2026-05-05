'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, X, FileText } from 'lucide-react'
import { SUPPORT_PHONE, CATALOG_BACKUP_URL } from '@/lib/errorRecovery'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  sectionName?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-6 my-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                {this.props.sectionName ? `${this.props.sectionName} Error` : 'Error'}
              </h3>
              <p className="text-sm text-slate-300 mb-2">
                {this.state.error?.message || 'An error occurred. Do not touch what\'s broken.'}
              </p>
              <p className="text-xs text-amber-400/90 mb-3">Contact support: <a href={`tel:${SUPPORT_PHONE}`} className="font-semibold">{SUPPORT_PHONE}</a></p>
              <div className="flex flex-wrap gap-2 mb-3">
                <a
                  href={CATALOG_BACKUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                >
                  <FileText className="w-3 h-3" />
                  Catalog backup
                </a>
              </div>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
              >
                Reload Section
              </button>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
