'use client'

import { useState, useEffect } from 'react'
import { Brain, TrendingUp, Activity, Sparkles, Zap, Calendar } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'

interface AIInsight {
  title: string
  category: string
  insight: string
  recommendation: string
  trend: 'up' | 'down' | 'stable'
  artist?: string
}

interface Analysis {
  id: string
  analysis: {
    insights: AIInsight[]
    summary: string
    artistSummaries?: Record<string, any>
  }
  generatedAt: any
}

export default function AIInsightsPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAnalyses()
  }, [])

  const fetchAnalyses = async () => {
    try {
      const res = await fetch('/api/get-analyses')
      const data = await res.json()
      if (data.success) {
        setAnalyses(data.analyses)
        if (data.analyses.length > 0) {
          setSelectedAnalysis(data.analyses[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const insights = selectedAnalysis?.analysis?.insights || []
  const streamingTrends = insights.filter(i => i.category === 'streaming_trends')
  const performanceInsights = insights.filter(i => i.category === 'performance')
  const engagementInsights = insights.filter(i => i.category === 'engagement')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">AI Insights</h1>
        <p className="text-slate-400">AI-powered analysis of your streaming data</p>
      </div>

      {analyses.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
          <Brain className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Analyses Available</h3>
          <p className="text-slate-400 mb-4">Upload CSV data and generate AI insights to see analysis here</p>
          <p className="text-sm text-slate-500">Go to Upload Data page to get started</p>
        </div>
      ) : (
        <>
          {/* Analysis Selection */}
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Select Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyses.map((analysis) => (
                <button
                  key={analysis.id}
                  onClick={() => setSelectedAnalysis(analysis)}
                  className={`p-4 rounded-lg border transition text-left ${
                    selectedAnalysis?.id === analysis.id
                      ? 'border-red-600 bg-red-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Brain className="w-5 h-5 text-red-500" />
                    <span className="text-xs text-slate-400">
                      {formatTimeAgo(analysis.generatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium">
                    {analysis.analysis.insights.length} insights
                  </p>
                </button>
              ))}
            </div>
          </div>

          {selectedAnalysis && (
            <>
              {/* Summary */}
              {selectedAnalysis.analysis.summary && (
                <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-purple-400" />
                    Summary
                  </h2>
                  <p className="text-slate-300 leading-relaxed">{selectedAnalysis.analysis.summary}</p>
                </div>
              )}

              {/* Streaming Trends - Full Width */}
              {streamingTrends.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                    Streaming Trends ({streamingTrends.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {streamingTrends.map((insight, idx) => (
                      <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-white text-sm">{insight.title}</h4>
                          {insight.artist && (
                            <span className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded">
                              {insight.artist}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 mb-2">{insight.insight}</p>
                        <div className="pt-2 border-t border-slate-700">
                          <p className="text-xs text-red-500 font-medium mb-1">Recommendation:</p>
                          <p className="text-xs text-slate-400">{insight.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights by Category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {performanceInsights.length > 0 && (
                  <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-red-500" />
                      Performance ({performanceInsights.length})
                    </h3>
                    <div className="space-y-4">
                      {performanceInsights.map((insight, idx) => (
                        <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-white text-sm">{insight.title}</h4>
                            {insight.artist && (
                              <span className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded">
                                {insight.artist}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-300 mb-2">{insight.insight}</p>
                          <div className="pt-2 border-t border-slate-700">
                            <p className="text-xs text-red-500 font-medium mb-1">Recommendation:</p>
                            <p className="text-xs text-slate-400">{insight.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {engagementInsights.length > 0 && (
                  <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-purple-400" />
                      Engagement ({engagementInsights.length})
                    </h3>
                    <div className="space-y-4">
                      {engagementInsights.map((insight, idx) => (
                        <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-white text-sm">{insight.title}</h4>
                            {insight.artist && (
                              <span className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded">
                                {insight.artist}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-300 mb-2">{insight.insight}</p>
                          <div className="pt-2 border-t border-slate-700">
                            <p className="text-xs text-red-500 font-medium mb-1">Recommendation:</p>
                            <p className="text-xs text-slate-400">{insight.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* All Insights Grid */}
              <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-400" />
                  All Insights ({insights.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 hover:border-red-500/50 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-white text-sm">{insight.title}</h3>
                        {insight.trend === 'up' && (
                          <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                        )}
                        {insight.trend === 'down' && (
                          <TrendingUp className="w-5 h-5 text-red-500 flex-shrink-0 rotate-180" />
                        )}
                        {insight.trend === 'stable' && (
                          <Activity className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      {insight.artist && (
                        <span className="inline-block text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded mb-2">
                          {insight.artist}
                        </span>
                      )}
                      <p className="text-sm text-slate-300 mb-2">{insight.insight}</p>
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-xs text-red-400 font-medium mb-1">Recommendation:</p>
                        <p className="text-xs text-slate-400">{insight.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

