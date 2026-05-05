/**
 * Artist Lane Definitions
 * Each lane has specific characteristics, audiences, and release strategies
 */

export type ArtistLane = 'underground' | 'regional' | 'faith' | 'creative' | 'inspirational'

export interface LaneDefinition {
  id: ArtistLane
  name: string
  description: string
  audience: string
  brand: string
  keyMetrics: string[]  // Which metrics matter most for this lane
  releaseStrategy: string
  visualStyle: string
  platforms: string[]
  collabFocus: string
}

export const LANE_DEFINITIONS: Record<ArtistLane, LaneDefinition> = {
  underground: {
    id: 'underground',
    name: 'Underground / Cult Lane',
    description: 'Building cult loyalty, not chasing charts',
    audience: 'Underground heads, SoundCloud kids, late-night listeners',
    brand: 'Mystery, raw, anti-industry',
    keyMetrics: ['saves', 'shares', 'comments'], // Engagement over reach
    releaseStrategy: 'Random drops, surprise releases, no long promo',
    visualStyle: 'Dark, grainy, low-budget-on-purpose',
    platforms: ['Spotify', 'SoundCloud', 'YouTube', 'Reddit', 'Discord'],
    collabFocus: 'Underground rappers only (no mainstream reach yet)',
  },
  regional: {
    id: 'regional',
    name: 'Regional / Bay Lane',
    description: 'City pride, motion, outside music',
    audience: 'Bay Area + West Coast',
    brand: 'City pride, motion, outside music',
    keyMetrics: ['views', 'shares', 'comments'], // Local engagement
    releaseStrategy: 'Consistent singles, heavy local promo',
    visualStyle: 'Street shots, cars, local landmarks',
    platforms: ['Apple Music', 'Instagram', 'YouTube'],
    collabFocus: 'Bay artists, local producers, DJs',
  },
  faith: {
    id: 'faith',
    name: 'Faith / Gospel Lane',
    description: 'Longevity + respect, not trends',
    audience: 'Church, families, faith-based listeners',
    brand: 'Clean, uplifting, timeless',
    keyMetrics: ['saves', 'followers', 'completionRate'], // Long-term value
    releaseStrategy: 'Albums/EPs > singles',
    visualStyle: 'Simple, warm, church + lifestyle',
    platforms: ['Facebook', 'YouTube', 'Apple Music'],
    collabFocus: 'Churches, gospel playlists, events',
  },
  creative: {
    id: 'creative',
    name: 'Creative / Alt-Pop Lane',
    description: 'Viral potential + brand deals',
    audience: 'Creatives, TikTok, art kids',
    brand: 'Aesthetic, expressive, different',
    keyMetrics: ['views', 'shares', 'completionRate'], // Viral metrics
    releaseStrategy: 'Concept singles, visuals-first',
    visualStyle: 'High-art, fashion, abstract concepts',
    platforms: ['TikTok', 'Instagram Reels', 'Spotify'],
    collabFocus: 'Designers, photographers, alt artists',
  },
  inspirational: {
    id: 'inspirational',
    name: 'Inspirational / Healing Lane',
    description: 'Deep emotional fans, not fast numbers',
    audience: 'Women, self-growth listeners, emotional music fans',
    brand: 'Healing, motivation, emotion',
    keyMetrics: ['saves', 'comments', 'completionRate'], // Deep engagement
    releaseStrategy: 'Singles with meaning, storytelling',
    visualStyle: 'Soft, cinematic, story-driven',
    platforms: ['Spotify', 'TikTok', 'YouTube'],
    collabFocus: 'Inspirational artists, spoken-word, R&B',
  },
}

/**
 * Get lane-specific explanation context
 */
export function getLaneExplanationContext(lane: ArtistLane): {
  readyExplanation: string
  buildingExplanation: string
  coolingExplanation: string
  oneLiner: string
} {
  const definitions: Record<ArtistLane, {
    readyExplanation: string
    buildingExplanation: string
    coolingExplanation: string
    oneLiner: string
  }> = {
    underground: {
      oneLiner: 'Your readiness reflects your underground audience\'s attention — not your creativity.',
      readyExplanation: 'Your cult audience is actively engaging. Underground drops work best when the community is already paying attention. Release now and your core fans will carry it. This is when drops feel organic, timely, and "outta nowhere" to fans.',
      buildingExplanation: 'Your underground community is building but not quite concentrated yet. Let anticipation build — surprise drops hit harder when the audience is ready. Releasing right now wouldn\'t fail, but it wouldn\'t hit as hard as it could. This stage is about setting up the moment, not forcing it.',
      coolingExplanation: 'Your underground audience is quiet right now. A drop would get overlooked — even if the song is good. Short silence, reset content style, let them miss you. Posting less, not more. This stage protects your music from dying on arrival.',
    },
    regional: {
      oneLiner: 'Your readiness reflects your local audience\'s attention — not your creativity.',
      readyExplanation: 'Your Bay/West Coast audience is engaged and active. Local buzz is building. This is the right time for a release that will get real-world motion. If you release now, your audience is most likely to notice, engage, and carry the song forward.',
      buildingExplanation: 'Your regional audience is steady but not peaking yet. Consistent singles work better when local engagement is concentrated. Releasing right now wouldn\'t fail — but it wouldn\'t hit as hard as it could. Keep building local buzz. This stage is about setting up the moment, not forcing it.',
      coolingExplanation: 'Your regional audience attention is scattered. A release right now wouldn\'t get the local push it needs — even if the song is good. Focus on local events and connections first. Let the audience miss you. This stage protects your music from dying on arrival.',
    },
    faith: {
      oneLiner: 'Your readiness reflects your faith community\'s attention — not your creativity.',
      readyExplanation: 'Your faith-based audience is engaged and receptive. This is when releases build longevity and respect. Your community is ready to carry the message forward. If you release now, your audience is most likely to notice, engage, and carry the song forward.',
      buildingExplanation: 'Your faith community is steady but building. Albums and EPs work best when the community is fully engaged. Releasing right now wouldn\'t fail — but it wouldn\'t hit as hard as it could. Let the foundation strengthen. This stage is about setting up the moment, not forcing it.',
      coolingExplanation: 'Your faith community is quiet. Rushing a release now wouldn\'t honor the message or the audience — even if the song is good. Focus on community connection and let timing align. This stage protects your music from dying on arrival.',
    },
    creative: {
      oneLiner: 'Your readiness reflects your creative audience\'s attention — not your creativity.',
      readyExplanation: 'Your creative audience is active and sharing. Visuals-first releases work best when the art kids are already engaged. This is when viral potential is highest. If you release now, your audience is most likely to notice, engage, and carry the song forward.',
      buildingExplanation: 'Your creative audience is building but not spreading yet. Concept singles need the right moment. Releasing right now wouldn\'t fail — but it wouldn\'t hit as hard as it could. Keep creating — the aesthetic will land when attention is concentrated. This stage is about setting up the moment, not forcing it.',
      coolingExplanation: 'Your creative audience is quiet. A drop now would get lost in the noise — even if the song is good. Reset the visual style, let anticipation build. Posting less, not more. This protects your brand from looking forced and your music from dying on arrival.',
    },
    inspirational: {
      oneLiner: 'Your readiness reflects your healing audience\'s attention — not your creativity.',
      readyExplanation: 'Your emotional audience is deeply engaged. Storytelling releases work best when listeners are ready to feel. This is when your message will resonate most. If you release now, your audience is most likely to notice, engage, and carry the song forward.',
      buildingExplanation: 'Your healing audience is steady but building. Meaningful singles need emotional readiness. Releasing right now wouldn\'t fail — but it wouldn\'t hit as hard as it could. Keep connecting — deep fans respond when the timing feels right. This stage is about setting up the moment, not forcing it.',
      coolingExplanation: 'Your inspirational audience is quiet. A release now wouldn\'t land emotionally — even if the song is good. Focus on authentic connection, let the audience come back naturally. Posting less, not more. This protects your message\'s impact and your music from dying on arrival.',
    },
  }

  return definitions[lane] || definitions.inspirational // Default fallback
}
