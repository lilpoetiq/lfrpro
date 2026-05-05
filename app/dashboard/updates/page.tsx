'use client'

import { FileText, Calendar, Sparkles } from 'lucide-react'
import { APP_NAME, APP_VERSION, CHANGELOG } from '@/lib/version'

/** Map type to display label */
function typeLabel(type: string) {
  switch (type) {
    case 'bugfix': return 'Bug Fix'
    case 'major': return 'Major Update'
    case 'huge': return 'Major Release'
    default: return 'Update'
  }
}

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Updates & Release Notes</h1>
          <p className="text-slate-400">Stay informed about the latest features and improvements</p>
          <p className="text-slate-500 text-sm mt-1 font-mono">Current: {APP_NAME} {APP_VERSION}</p>
        </div>
      </div>

      <div className="space-y-6">
        {CHANGELOG.map((update, index) => (
          <div
            key={index}
            className="bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 shadow-lg overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-red-600/20 p-3 rounded-lg">
                    <Sparkles className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{update.title}</h2>
                    <div className="flex items-center space-x-4 mt-1 flex-wrap gap-x-4 gap-y-1">
                      <span className="text-sm font-semibold text-red-600">{APP_NAME} {update.version}</span>
                      <span className="text-slate-500 text-xs">{typeLabel(update.type)}</span>
                      <div className="flex items-center space-x-1 text-slate-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(update.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-slate-300 mb-6 leading-relaxed">{update.description}</p>

              {(update.features?.length ?? 0) > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-green-400" />
                    <span>New Features</span>
                  </h3>
                  <ul className="space-y-2">
                    {(update.features || []).map((feature, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-slate-300">
                        <span className="text-green-400 mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(update.improvements?.length ?? 0) > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <span>Improvements</span>
                  </h3>
                  <ul className="space-y-2">
                    {(update.improvements || []).map((improvement, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-slate-300">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(update.fixes?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-yellow-400" />
                    <span>Bug Fixes</span>
                  </h3>
                  <ul className="space-y-2">
                    {(update.fixes || []).map((fix, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-slate-300">
                        <span className="text-yellow-400 mt-1">•</span>
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {CHANGELOG.length === 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 shadow-lg">
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No updates available yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

