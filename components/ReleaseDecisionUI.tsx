'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle, CheckCircle2, X, Calendar, FileText, Image, Upload, TrendingUp, BarChart3, Info, Rocket } from 'lucide-react'

interface ReleaseRequest {
  releaseType: 'single' | 'ep' | 'album' | 'visual'
  intendedTimeframe: 'asap' | 'this_month' | 'next_month'
  assetsConfirmed: {
    finalMixMaster: boolean
    coverArt: boolean
    distributionFiles: boolean
  }
}

interface ReleaseDecision {
  decision: 'APPROVED' | 'HOLD' | 'DENIED' | 'UNDER_REVIEW'
  decidedAt?: string
  releaseWindow?: {
    open: boolean
    durationDays: number
    expiresAt: string
  }
  approvalReason?: string
  rules?: string[]
  holdReasons?: {
    audienceReadiness?: string[]
    momentum?: string[]
    execution?: string[]
    dataGaps?: string[]
  }
  actionableTasks?: Array<{
    id: string
    task: string
    measurable: boolean
    completed: boolean
  }>
  denialReason?: string
  expectedOutcome?: string
  rebuildPlan?: string[]
  cooldownPeriodDays?: number
  cooldownUntil?: string
  evidence?: {
    heatScore?: number
    momentumSpeed?: number
    confidenceIndex?: number
    simulationOutcome?: string
    metrics?: any
  }
}

interface ReleaseDecisionUIProps {
  artistId: string
  decision?: ReleaseDecision
  releaseRequest?: ReleaseRequest
  onSubmitRequest: (request: ReleaseRequest) => Promise<void>
  onConfirmRelease?: () => Promise<void>
}

export default function ReleaseDecisionUI({
  artistId,
  decision,
  releaseRequest,
  onSubmitRequest,
  onConfirmRelease,
}: ReleaseDecisionUIProps) {
  const [showRequestForm, setShowRequestForm] = useState(!releaseRequest && !decision)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ReleaseRequest>({
    releaseType: 'single',
    intendedTimeframe: 'asap',
    assetsConfirmed: {
      finalMixMaster: false,
      coverArt: false,
      distributionFiles: false,
    },
  })

  const handleGetGuidance = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    try {
      await onSubmitRequest({
        releaseType: formData.releaseType,
        intendedTimeframe: formData.intendedTimeframe,
        assetsConfirmed: {
          finalMixMaster: true,
          coverArt: true,
          distributionFiles: true,
        },
      })
    } catch (error) {
      console.error('Failed to get release guidance:', error)
      alert(`Failed to get release guidance: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`)
      setIsSubmitting(false)
    } finally {
      setTimeout(() => {
        setIsSubmitting(false)
      }, 2000)
    }
  }
  
  // Reset submitting state when decision or releaseRequest changes
  useEffect(() => {
    if ((decision || releaseRequest) && isSubmitting) {
      setIsSubmitting(false)
      setShowRequestForm(false)
    }
  }, [decision, releaseRequest, isSubmitting])

  // RELEASE GUIDANCE TOOL - Shows why releasing would be beneficial
  if (showRequestForm || (!decision && !releaseRequest)) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center">
                <BarChart3 className="w-6 h-6 mr-2 text-blue-400" />
                Release Readiness Guidance
              </h2>
              <p className="text-slate-400 text-sm">Understand why releasing now could benefit your career</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Release Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">What are you planning to release?</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['single', 'ep', 'album', 'visual'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, releaseType: type })}
                    className={`p-4 rounded-lg border-2 transition ${
                      formData.releaseType === type
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-semibold capitalize">{type}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Intended Timeframe */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">When are you thinking of releasing?</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'asap', label: 'ASAP' },
                  { value: 'this_month', label: 'This Month' },
                  { value: 'next_month', label: 'Next Month' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFormData({ ...formData, intendedTimeframe: value })}
                    className={`p-4 rounded-lg border-2 transition ${
                      formData.intendedTimeframe === value
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-slate-300">
                    This tool analyzes your current audience growth, momentum, and engagement data to explain why releasing now could be strategically beneficial. 
                    It's designed to help you make informed decisions, not to force you into a release.
                  </p>
                </div>
              </div>
            </div>

            {/* Get Guidance Button */}
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Button clicked - starting guidance request')
                try {
                  await handleGetGuidance(e)
                } catch (error) {
                  console.error('Error in button click handler:', error)
                  alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
                }
              }}
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  <span>Get Release Guidance</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // UNDER REVIEW STATE
  if (decision?.decision === 'UNDER_REVIEW' || (releaseRequest && !decision)) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-8 border border-slate-800 shadow-lg">
        <div className="text-center">
          <Clock className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h2 className="text-2xl font-bold text-white mb-2">Analyzing Your Data</h2>
          <p className="text-slate-400 mb-4">We're analyzing your audience growth, momentum, and engagement patterns.</p>
          <p className="text-slate-500 text-sm">
            This will help explain why releasing now could be strategically beneficial for your career.
          </p>
        </div>
      </div>
    )
  }

  if (!decision) return null

  // APPROVED STATE
  if (decision.decision === 'APPROVED') {
    const daysRemaining = decision.releaseWindow
      ? Math.ceil((new Date(decision.releaseWindow.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0

    return (
      <div className="space-y-6">
        {/* Status Banner */}
        <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 border-2 border-green-500 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-400 mr-4" />
              <div>
                <h2 className="text-2xl font-bold text-white">APPROVED</h2>
                <p className="text-green-300 mt-1">
                  Release Window: <span className="font-semibold">OPEN</span> ({daysRemaining} days remaining)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Info className="w-5 h-5 mr-2 text-blue-400" />
            Why This Was Approved
          </h3>
          <p className="text-slate-300 mb-4">{decision.approvalReason}</p>
          <ul className="space-y-2">
            {decision.rules?.map((rule, idx) => (
              <li key={idx} className="flex items-start text-slate-400">
                <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Rules */}
        {decision.rules && decision.rules.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-3">Rules</h3>
            <ul className="space-y-2">
              {decision.rules.map((rule, idx) => (
                <li key={idx} className="text-slate-400 flex items-start">
                  <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 text-yellow-400 flex-shrink-0" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Guidance Note */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-green-300 font-medium mb-1">Ready to Release</p>
              <p className="text-sm text-slate-300">
                Based on your current data, releasing now aligns well with your audience momentum and growth trajectory. 
                This is guidance to help inform your decision - you're in control of when you release.
              </p>
            </div>
          </div>
        </div>

        {/* Evidence (Secondary) */}
        {decision.evidence && (
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-400 mb-3">Evidence Used in This Decision</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {decision.evidence.heatScore !== undefined && typeof decision.evidence.heatScore === 'number' && (
                <div>
                  <div className="text-slate-500">Heat Score</div>
                  <div className="text-white font-semibold">{decision.evidence.heatScore.toFixed(1)}</div>
                </div>
              )}
              {decision.evidence.momentumSpeed !== undefined && typeof decision.evidence.momentumSpeed === 'number' && (
                <div>
                  <div className="text-slate-500">Momentum Speed</div>
                  <div className="text-white font-semibold">{decision.evidence.momentumSpeed.toFixed(1)}</div>
                </div>
              )}
              {decision.evidence.confidenceIndex !== undefined && typeof decision.evidence.confidenceIndex === 'number' && (
                <div>
                  <div className="text-slate-500">Confidence Index</div>
                  <div className="text-white font-semibold">{decision.evidence.confidenceIndex.toFixed(1)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // HOLD STATE
  if (decision.decision === 'HOLD') {
    return (
      <div className="space-y-6">
        {/* Status Banner */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500 rounded-xl p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mr-4" />
            <div>
              <h2 className="text-2xl font-bold text-white">HOLD</h2>
              <p className="text-yellow-300 mt-1">Fix Required</p>
            </div>
          </div>
        </div>

        {/* Why Approval Is Blocked */}
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4">Why Approval Is Blocked</h3>
          <div className="space-y-4">
            {decision.holdReasons?.audienceReadiness && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Audience Readiness</h4>
                <ul className="space-y-1">
                  {decision.holdReasons.audienceReadiness.map((reason, idx) => (
                    <li key={idx} className="text-slate-300 flex items-start">
                      <XCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.holdReasons?.momentum && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Momentum</h4>
                <ul className="space-y-1">
                  {decision.holdReasons.momentum.map((reason, idx) => (
                    <li key={idx} className="text-slate-300 flex items-start">
                      <XCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.holdReasons?.execution && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Execution</h4>
                <ul className="space-y-1">
                  {decision.holdReasons.execution.map((reason, idx) => (
                    <li key={idx} className="text-slate-300 flex items-start">
                      <XCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.holdReasons?.dataGaps && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Data Gaps</h4>
                <ul className="space-y-1">
                  {decision.holdReasons.dataGaps.map((reason, idx) => (
                    <li key={idx} className="text-slate-300 flex items-start">
                      <XCircle className="w-4 h-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Actionable Tasks */}
        {decision.actionableTasks && decision.actionableTasks.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-4">What Must Be Fixed</h3>
            <div className="space-y-3">
              {decision.actionableTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start p-4 rounded-lg border border-slate-700 bg-slate-800/50"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    disabled
                    className="w-5 h-5 text-red-500 rounded border-slate-600 mt-0.5"
                  />
                  <span className={`ml-3 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                    {task.task}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence (Secondary) */}
        {decision.evidence && (
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-400 mb-3">Evidence Used in This Decision</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {decision.evidence.heatScore !== undefined && typeof decision.evidence.heatScore === 'number' && (
                <div>
                  <div className="text-slate-500">Heat Score</div>
                  <div className="text-white font-semibold">{decision.evidence.heatScore.toFixed(1)}</div>
                </div>
              )}
              {decision.evidence.momentumSpeed !== undefined && typeof decision.evidence.momentumSpeed === 'number' && (
                <div>
                  <div className="text-slate-500">Momentum Speed</div>
                  <div className="text-white font-semibold">{decision.evidence.momentumSpeed.toFixed(1)}</div>
                </div>
              )}
              {decision.evidence.confidenceIndex !== undefined && typeof decision.evidence.confidenceIndex === 'number' && (
                <div>
                  <div className="text-slate-500">Confidence Index</div>
                  <div className="text-white font-semibold">{decision.evidence.confidenceIndex.toFixed(1)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // DENIED STATE
  if (decision.decision === 'DENIED') {
    const cooldownDays = decision.cooldownUntil
      ? Math.ceil((new Date(decision.cooldownUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : decision.cooldownPeriodDays || 14

    return (
      <div className="space-y-6">
        {/* Status Banner */}
        <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-500 rounded-xl p-6">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-red-400 mr-4" />
            <div>
              <h2 className="text-2xl font-bold text-white">DENIED</h2>
              <p className="text-red-300 mt-1">
                Cooldown period: {cooldownDays} days before re-request
              </p>
            </div>
          </div>
        </div>

        {/* Why This Was Denied */}
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">Why This Was Denied</h3>
          <p className="text-slate-300 mb-4">{decision.denialReason}</p>
        </div>

        {/* Expected Outcome */}
        {decision.expectedOutcome && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-3">Expected Outcome If Released Now</h3>
            <p className="text-slate-300">{decision.expectedOutcome}</p>
          </div>
        )}

        {/* Rebuild Plan */}
        {decision.rebuildPlan && decision.rebuildPlan.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-4">Rebuild Plan</h3>
            <ul className="space-y-2">
              {decision.rebuildPlan.map((step, idx) => (
                <li key={idx} className="text-slate-300 flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evidence (Secondary) */}
        {decision.evidence && (
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-400 mb-3">Evidence Used in This Decision</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {decision.evidence.heatScore !== undefined && typeof decision.evidence.heatScore === 'number' && (
                <div>
                  <div className="text-slate-500">Heat Score</div>
                  <div className="text-white font-semibold">{decision.evidence.heatScore.toFixed(1)}</div>
                </div>
              )}
              {decision.evidence.momentumSpeed !== undefined && typeof decision.evidence.momentumSpeed === 'number' && (
                <div>
                  <div className="text-slate-500">Momentum Speed</div>
                  <div className="text-white font-semibold">{decision.evidence.momentumSpeed.toFixed(1)}</div>
                </div>
              )}
              {decision.evidence.confidenceIndex !== undefined && typeof decision.evidence.confidenceIndex === 'number' && (
                <div>
                  <div className="text-slate-500">Confidence Index</div>
                  <div className="text-white font-semibold">{decision.evidence.confidenceIndex.toFixed(1)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
