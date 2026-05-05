'use client'

import { useState, useEffect } from 'react'
import {
  BookOpen,
  Sparkles,
  Edit,
  Save,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  GitCompare,
  Loader2,
} from 'lucide-react'

interface Song {
  id: string
  song: string
  artist: string
  releaseDate?: string
  releaseType?: string
  campaignStatus?: string
  campaignScore?: number
  campaignOutcome?: string
  campaignSummary?: string
  lessonsLearned?: string
  strategyToRepeat?: string
  strategyToAvoid?: string
  blueprintReady?: boolean
}

interface CampaignBlueprintSectionProps {
  song: Song
  songId: string
  canEdit: boolean
  userId: string
  onRefresh: () => void
}

export default function CampaignBlueprintSection({
  song,
  songId,
  canEdit,
  userId,
  onRefresh,
}: CampaignBlueprintSectionProps) {
  const [suggestedExample, setSuggestedExample] = useState<any>(null)
  const [aiRecommendation, setAiRecommendation] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showRecommendation, setShowRecommendation] = useState(false)
  const [insightQuestion, setInsightQuestion] = useState('')
  const [insightAnswer, setInsightAnswer] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)
  const [compareSongId, setCompareSongId] = useState('')
  const [compareData, setCompareData] = useState<any>(null)
  const [editingScore, setEditingScore] = useState(false)
  const [scoreForm, setScoreForm] = useState({
    campaignScore: song.campaignScore ?? '',
    campaignOutcome: song.campaignOutcome ?? '',
    campaignSummary: song.campaignSummary ?? '',
    lessonsLearned: song.lessonsLearned ?? '',
    strategyToRepeat: song.strategyToRepeat ?? '',
    strategyToAvoid: song.strategyToAvoid ?? '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const status = song.campaignStatus || 'upcoming'
  const isUpcoming = status === 'upcoming'
  const isCompleted = status === 'completed' || status === 'archived'

  useEffect(() => {
    setScoreForm({
      campaignScore: song.campaignScore ?? '',
      campaignOutcome: song.campaignOutcome ?? '',
      campaignSummary: song.campaignSummary ?? '',
      lessonsLearned: song.lessonsLearned ?? '',
      strategyToRepeat: song.strategyToRepeat ?? '',
      strategyToAvoid: song.strategyToAvoid ?? '',
    })
  }, [song])

  // Auto-suggest example for upcoming songs
  useEffect(() => {
    if (isUpcoming) {
      fetch(`/api/campaign-blueprint/recommend?songId=${encodeURIComponent(songId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.hasExample) setSuggestedExample(d)
        })
        .catch(() => {})
    }
  }, [songId, isUpcoming])

  const handleUseExample = async () => {
    if (!suggestedExample?.example?.id) return
    setAiLoading(true)
    setShowRecommendation(true)
    try {
      const res = await fetch('/api/campaign-blueprint/ai-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId, exampleSongId: suggestedExample.example.id }),
      })
      const data = await res.json()
      if (data.success) setAiRecommendation(data)
    } catch (e) {
      setAiRecommendation({ error: 'Failed to generate recommendation' })
    } finally {
      setAiLoading(false)
    }
  }

  const handleAskInsight = async () => {
    if (!insightQuestion.trim()) return
    setInsightLoading(true)
    try {
      const res = await fetch('/api/campaign-blueprint/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId, question: insightQuestion.trim() }),
      })
      const data = await res.json()
      if (data.success) setInsightAnswer(data.answer)
    } catch (e) {
      setInsightAnswer('Failed to get insight.')
    } finally {
      setInsightLoading(false)
    }
  }

  const handleCompare = async () => {
    if (!compareSongId.trim()) return
    try {
      const res = await fetch(
        `/api/campaign-blueprint/compare?songA=${encodeURIComponent(songId)}&songB=${encodeURIComponent(compareSongId)}`
      )
      const data = await res.json()
      if (data.success) setCompareData(data)
    } catch (e) {
      setCompareData(null)
    }
  }

  const handleSaveScore = async () => {
    if (!canEdit) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/catalog/${songId}/campaign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          campaignScore: scoreForm.campaignScore ? Number(scoreForm.campaignScore) : undefined,
          campaignOutcome: scoreForm.campaignOutcome || undefined,
          campaignSummary: scoreForm.campaignSummary.trim() || undefined,
          lessonsLearned: scoreForm.lessonsLearned.trim() || undefined,
          strategyToRepeat: scoreForm.strategyToRepeat.trim() || undefined,
          strategyToAvoid: scoreForm.strategyToAvoid.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingScore(false)
        onRefresh()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBlueprint = async () => {
    if (!canEdit) return
    try {
      const res = await fetch(`/api/catalog/${songId}/campaign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, blueprintReady: !song.blueprintReady }),
      })
      if (res.ok) onRefresh()
    } catch (e) {}
  }

  const rec = aiRecommendation?.recommendation

  return (
    <div className="space-y-6">
      {/* Campaign Score (completed only) */}
      {isCompleted && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-red-400" />
            Campaign Score & Blueprint
          </h3>
          {editingScore && canEdit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Score (1–10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={scoreForm.campaignScore}
                    onChange={(e) => setScoreForm((s) => ({ ...s, campaignScore: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Outcome</label>
                  <select
                    value={scoreForm.campaignOutcome}
                    onChange={(e) => setScoreForm((s) => ({ ...s, campaignOutcome: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  >
                    <option value="">—</option>
                    <option value="strong">Strong</option>
                    <option value="average">Average</option>
                    <option value="weak">Weak</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Summary</label>
                <textarea
                  value={scoreForm.campaignSummary}
                  onChange={(e) => setScoreForm((s) => ({ ...s, campaignSummary: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Lessons learned</label>
                <textarea
                  value={scoreForm.lessonsLearned}
                  onChange={(e) => setScoreForm((s) => ({ ...s, lessonsLearned: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Strategy to repeat</label>
                <textarea
                  value={scoreForm.strategyToRepeat}
                  onChange={(e) => setScoreForm((s) => ({ ...s, strategyToRepeat: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Strategy to avoid</label>
                <textarea
                  value={scoreForm.strategyToAvoid}
                  onChange={(e) => setScoreForm((s) => ({ ...s, strategyToAvoid: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveScore}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditingScore(false)} className="px-3 py-1.5 bg-slate-700 rounded text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                {song.campaignScore != null && (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold">
                    {song.campaignScore}/10
                  </span>
                )}
                {song.campaignOutcome && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      song.campaignOutcome === 'strong'
                        ? 'bg-green-500/30 text-green-400'
                        : song.campaignOutcome === 'weak'
                        ? 'bg-amber-500/30 text-amber-400'
                        : 'bg-slate-500/30 text-slate-400'
                    }`}
                  >
                    {song.campaignOutcome}
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={handleToggleBlueprint}
                    className={`px-2 py-1 rounded text-xs border transition ${
                      song.blueprintReady
                        ? 'bg-blue-500/30 text-blue-400 border-blue-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-600'
                    }`}
                  >
                    {song.blueprintReady ? '✓ Blueprint Ready' : '+ Mark as Blueprint'}
                  </button>
                )}
              </div>
              {song.campaignSummary && <p className="text-slate-300 text-sm">{song.campaignSummary}</p>}
              {song.lessonsLearned && (
                <p className="text-slate-400 text-xs">
                  <strong>Lessons:</strong> {song.lessonsLearned}
                </p>
              )}
              {song.strategyToRepeat && (
                <p className="text-green-400/80 text-xs">
                  <strong>Repeat:</strong> {song.strategyToRepeat}
                </p>
              )}
              {song.strategyToAvoid && (
                <p className="text-amber-400/80 text-xs">
                  <strong>Avoid:</strong> {song.strategyToAvoid}
                </p>
              )}
              {canEdit && (
                <button onClick={() => setEditingScore(true)} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm">
                  <Edit className="w-4 h-4" /> Edit score
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Use Past Campaign as Example (upcoming only) */}
      {isUpcoming && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-blue-500/30">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Campaign Blueprint
          </h3>
          {suggestedExample?.hasExample ? (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">
                Suggested example: <span className="text-white font-medium">{suggestedExample.example.song}</span> by{' '}
                {suggestedExample.example.artist}
                {suggestedExample.useAsLearningOnly && (
                  <span className="ml-2 text-amber-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Use as learning example only
                  </span>
                )}
              </p>
              <button
                onClick={handleUseExample}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Use Past Campaign as Example
              </button>
              {showRecommendation && rec && (
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                  {rec.warning && (
                    <p className="text-amber-400 text-sm flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {rec.warning}
                    </p>
                  )}
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Example Based On: {rec.exampleBasedOn}</p>
                    {rec.releaseDate && <p className="text-slate-400 text-xs">Release: {rec.releaseDate}</p>}
                    {rec.totalStreamsMonth1 != null && (
                      <p className="text-slate-400 text-xs">Month 1 streams: {rec.totalStreamsMonth1.toLocaleString()}</p>
                    )}
                  </div>
                  {rec.whatWorked?.length > 0 && (
                    <div>
                      <p className="text-green-400 text-xs font-medium mb-1">What Worked:</p>
                      <ul className="list-disc list-inside text-slate-300 text-xs space-y-0.5">
                        {rec.whatWorked.map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.whatHurt?.length > 0 && (
                    <div>
                      <p className="text-amber-400 text-xs font-medium mb-1">What Hurt:</p>
                      <ul className="list-disc list-inside text-slate-300 text-xs space-y-0.5">
                        {rec.whatHurt.map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.whatFailed?.length > 0 && (
                    <div>
                      <p className="text-red-400 text-xs font-medium mb-1">What Failed:</p>
                      <ul className="list-disc list-inside text-slate-300 text-xs space-y-0.5">
                        {rec.whatFailed.map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.avoidThisBy?.length > 0 && (
                    <div>
                      <p className="text-amber-400 text-xs font-medium mb-1">Avoid This By:</p>
                      <ul className="list-disc list-inside text-slate-300 text-xs space-y-0.5">
                        {rec.avoidThisBy.map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.recommendationForNewRelease?.length > 0 && (
                    <div>
                      <p className="text-blue-400 text-xs font-medium mb-1">Recommendation For New Release:</p>
                      <ul className="list-disc list-inside text-slate-300 text-xs space-y-0.5">
                        {rec.recommendationForNewRelease.map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              {suggestedExample?.message || 'Loading...'}
            </p>
          )}
        </div>
      )}

      {/* AI Strategic Insight (all songs) */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-red-400" />
          Ask Campaign Insight
        </h3>
        <p className="text-slate-500 text-xs mb-2">
          e.g. &quot;Was this rollout too long?&quot; &quot;Did posting every other day hurt engagement?&quot;
        </p>
        <div className="flex gap-2">
          <input
            value={insightQuestion}
            onChange={(e) => setInsightQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskInsight()}
            placeholder="Type your question..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <button
            onClick={handleAskInsight}
            disabled={insightLoading || !insightQuestion.trim()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm"
          >
            {insightLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
          </button>
        </div>
        {insightAnswer && (
          <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{insightAnswer}</p>
          </div>
        )}
      </div>

      {/* Compare Campaigns */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-red-400" />
          Compare Campaigns
        </h3>
        <p className="text-slate-500 text-xs mb-2">Enter another song&apos;s ID from its URL (e.g. midnight-freestyle-by-gp3asy)</p>
        <div className="flex gap-2">
          <input
            value={compareSongId}
            onChange={(e) => setCompareSongId(e.target.value)}
            placeholder="song-slug-by-artist"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <button
            onClick={handleCompare}
            disabled={!compareSongId.trim()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm"
          >
            Compare
          </button>
        </div>
        {compareData && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-white font-medium text-sm">{compareData.songA.song}</p>
              <p className="text-slate-500 text-xs">{compareData.songA.artist}</p>
              <p className="text-slate-400 text-xs mt-2">
                Score: {compareData.songA.campaignScore ?? '—'}/10 · {compareData.songA.campaignOutcome || '—'}
              </p>
              <p className="text-slate-400 text-xs">Streams: {(compareData.songA.totalStreams ?? 0).toLocaleString()}</p>
              <p className="text-slate-400 text-xs">Events: {compareData.songA.eventCount}</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-white font-medium text-sm">{compareData.songB.song}</p>
              <p className="text-slate-500 text-xs">{compareData.songB.artist}</p>
              <p className="text-slate-400 text-xs mt-2">
                Score: {compareData.songB.campaignScore ?? '—'}/10 · {compareData.songB.campaignOutcome || '—'}
              </p>
              <p className="text-slate-400 text-xs">Streams: {(compareData.songB.totalStreams ?? 0).toLocaleString()}</p>
              <p className="text-slate-400 text-xs">Events: {compareData.songB.eventCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
