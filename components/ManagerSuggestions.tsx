'use client'

import { Sparkles, TrendingUp, Users, Music, Target, Megaphone } from 'lucide-react'

interface Suggestion {
  id: string
  title: string
  description: string
  category: 'content' | 'promotion' | 'strategy' | 'engagement'
  icon: any
}

export default function ManagerSuggestions() {
  const suggestions: Suggestion[] = [
    {
      id: '1',
      title: 'TikTok Strategy Boost',
      description: 'Create 3-5 short-form video clips (15-30 seconds) highlighting the catchiest hooks. Post at peak engagement times (6-9 PM) for maximum reach. Use trending sounds and hashtags relevant to your genre.',
      category: 'promotion',
      icon: Megaphone,
    },
    {
      id: '2',
      title: 'Playlist Pitching Campaign',
      description: 'Submit to 20+ Spotify playlists via SubmitHub, PlaylistPush, and direct curator outreach. Focus on playlists with 10K-100K followers in your genre. Include a compelling pitch with streaming links.',
      category: 'promotion',
      icon: Music,
    },
    {
      id: '3',
      title: 'Behind-the-Scenes Content',
      description: 'Share studio footage, production process, or songwriting sessions. This builds connection and gives fans exclusive content. Post across Instagram Reels, TikTok, and YouTube Shorts.',
      category: 'content',
      icon: Sparkles,
    },
    {
      id: '4',
      title: 'Collaboration Opportunities',
      description: 'Reach out to 3-5 artists in similar genres for potential collaborations or features. Cross-promotion can significantly expand your reach and introduce you to new audiences.',
      category: 'strategy',
      icon: Users,
    },
    {
      id: '5',
      title: 'Instagram Reels Series',
      description: 'Create a 5-part Reels series leading up to release: Day 1 - Teaser, Day 2 - Behind scenes, Day 3 - Lyrics preview, Day 4 - Countdown, Day 5 - Release announcement. Use consistent visual branding.',
      category: 'content',
      icon: TrendingUp,
    },
    {
      id: '6',
      title: 'Engage with Fan Comments',
      description: 'Respond to every comment and DM for the first 48 hours after release. Personal engagement builds loyal fanbase and increases algorithm visibility. Set aside 2 hours daily for engagement.',
      category: 'engagement',
      icon: Target,
    },
    {
      id: '7',
      title: 'Spotify Canvas Optimization',
      description: 'Create an eye-catching Spotify Canvas (8-second loop) that represents the song\'s vibe. Canvases increase save rates by 5-10%. Update it monthly to keep it fresh.',
      category: 'content',
      icon: Music,
    },
    {
      id: '8',
      title: 'Press Kit & Blog Outreach',
      description: 'Send professionally formatted press kit to music blogs, online magazines, and influencers. Include high-res photos, bio, streaming links, and a personal note. Target 15-20 publications.',
      category: 'promotion',
      icon: Megaphone,
    },
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'content':
        return 'bg-purple-500/20 text-purple-400'
      case 'promotion':
        return 'bg-red-500/20 text-red-400'
      case 'strategy':
        return 'bg-red-500/20 text-red-400'
      case 'engagement':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-slate-500/20 text-slate-400'
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Growth Ideas</h2>
          <p className="text-slate-400 text-sm">Actionable strategies to help songs blow up</p>
        </div>
        <Sparkles className="w-8 h-8 text-red-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon
          return (
            <div
              key={suggestion.id}
              className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 hover:border-red-500/50 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-lg ${getCategoryColor(suggestion.category)}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getCategoryColor(suggestion.category)}`}>
                    {suggestion.category}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-white text-sm mb-2">{suggestion.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{suggestion.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

