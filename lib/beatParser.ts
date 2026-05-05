/**
 * Beat filename parser
 * Extracts BPM, beat name, and producer names from filenames
 * 
 * Examples:
 * - "140_Outside_ProdByLegendaryFyre.wav" -> { bpm: 140, name: "Outside", producers: ["LegendaryFyre"] }
 * - "128_DarkFaith_ProdByJay x Tone.wav" -> { bpm: 128, name: "DarkFaith", producers: ["Jay", "Tone"] }
 * - "Outside_ProdByLegendaryFyre.wav" -> { bpm: undefined, name: "Outside", producers: ["LegendaryFyre"] }
 */

export interface ParsedBeatFilename {
  bpm?: number
  key?: string
  name: string
  producers: string[]
  originalFilename: string
  extension: string
}

/**
 * Extract BPM and key from a string
 * Handles formats like: "140 BPM Am", "140 Am", "Am 140", "Am", "140"
 */
function extractBpmAndKey(text: string): { bpm?: number; key?: string } {
  const result: { bpm?: number; key?: string } = {}
  
  // Musical keys pattern (A-G with optional #/b and m for minor)
  // More specific to avoid false matches in words
  const keyPattern = /\b([A-G][#b]?m?)\b(?![a-z])/i
  
  // BPM patterns: "140 BPM", "140", or just numbers
  const bpmPatterns = [
    /\b(\d{2,3})\s*bpm\b/i,  // "140 BPM"
    /\b(\d{2,3})\b/,          // "140" (standalone number)
  ]
  
  // Extract key first (before BPM to avoid conflicts)
  const keyMatch = text.match(keyPattern)
  if (keyMatch) {
    const matchedKey = keyMatch[1].toUpperCase()
    // Validate it's actually a key (not part of a word)
    if (/^[A-G][#b]?m?$/i.test(matchedKey)) {
      result.key = matchedKey
    }
  }
  
  // Extract BPM (check all matches, take the most reasonable one)
  for (const pattern of bpmPatterns) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'))
    for (const match of matches) {
      const bpmValue = parseInt(match[1], 10)
      if (bpmValue >= 60 && bpmValue <= 200) { // Reasonable BPM range
        // Check if it's not part of a larger number or word
        const before = text.substring(Math.max(0, match.index! - 1), match.index!)
        const after = text.substring(match.index! + match[0].length, match.index! + match[0].length + 1)
        if (!/\d/.test(before) && !/\d/.test(after)) {
          result.bpm = bpmValue
          break
        }
      }
    }
    if (result.bpm) break
  }
  
  return result
}

/**
 * Extract @mentions from text (like @iamethanswope)
 */
function extractMentions(text: string): string[] {
  const mentionPattern = /@(\w+)/g
  const mentions: string[] = []
  let match
  
  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push(match[1]) // Extract username without @
  }
  
  return mentions
}

/**
 * Parse a beat filename to extract metadata
 */
export function parseBeatFilename(filename: string): ParsedBeatFilename {
  // Remove extension
  const extension = filename.substring(filename.lastIndexOf('.'))
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))
  
  // Extract @mentions first (these are producers)
  const mentions = extractMentions(nameWithoutExt)
  const producers: string[] = [...mentions]
  
  // Remove @mentions from the text for further processing
  let textToParse = nameWithoutExt.replace(/@\w+/g, '').trim()
  
  // Extract BPM and key from the entire filename
  const { bpm, key } = extractBpmAndKey(textToParse)
  
  // Remove BPM and key patterns from text (more aggressive)
  textToParse = textToParse
    .replace(/\b\d{2,3}\s*bpm\b/gi, '')
    .replace(/\b([A-G][#b]?m?)\b(?![a-z])/gi, '') // More specific key pattern
    .replace(/\b(\d{2,3})\b/g, (match) => {
      const num = parseInt(match, 10)
      // Remove standalone numbers that look like BPM (60-200)
      if (num >= 60 && num <= 200) return ''
      return match
    })
    .trim()
  
  // Common separators: underscore, dash, space
  const parts = textToParse.split(/[_\-\s]+/).filter(p => p.length > 0)
  
  // Look for BPM at the start if not already found (numeric, typically 3 digits)
  let extractedBpm = bpm
  if (!extractedBpm && parts.length > 0 && /^\d{2,3}$/.test(parts[0])) {
    const potentialBpm = parseInt(parts[0], 10)
    if (potentialBpm >= 60 && potentialBpm <= 200) {
      extractedBpm = potentialBpm
      parts.shift() // Remove BPM from parts
    }
  }
  
  // Look for producer indicators
  const producerIndicators = ['prodby', 'prod', 'producedby', 'produced', 'by', 'x']
  let producerStartIndex = -1
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].toLowerCase()
    if (producerIndicators.some(indicator => part.includes(indicator))) {
      producerStartIndex = i
      break
    }
  }
  
  let nameParts: string[] = []
  
  if (producerStartIndex >= 0) {
    // Everything before producer indicator is the beat name
    nameParts = parts.slice(0, producerStartIndex)
    
    // Everything after producer indicator is producer names
    const producerParts = parts.slice(producerStartIndex + 1)
    
    // Parse producer names (can be separated by 'x', '&', 'and', etc.)
    let currentProducer: string[] = []
    for (const part of producerParts) {
      const lowerPart = part.toLowerCase()
      if (lowerPart === 'x' || lowerPart === '&' || lowerPart === 'and' || lowerPart === '+') {
        // Separator - finish current producer and start new one
        if (currentProducer.length > 0) {
          producers.push(currentProducer.join(' '))
          currentProducer = []
        }
      } else {
        currentProducer.push(part)
      }
    }
    if (currentProducer.length > 0) {
      producers.push(currentProducer.join(' '))
    }
  } else {
    // No producer indicator found - assume everything is the beat name
    nameParts = parts
  }
  
  // Clean up producer names first (before using them to clean the name)
  const cleanedProducers = producers
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // Remove @ symbol from mentions
      const withoutAt = p.replace(/^@+/, '')
      // Capitalize first letter of each word
      return withoutAt.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    })
    .filter((p, i, arr) => arr.indexOf(p) === i) // Remove duplicates
  
  // Clean up beat name (remove BPM/key/producer patterns that might remain)
  let name = nameParts.join(' ').trim() || textToParse || nameWithoutExt
  
  // Remove BPM patterns (more aggressive - including at start)
  name = name
    .replace(/^\s*\d{2,3}\s*bpm\s*/gi, '') // BPM at start
    .replace(/\b\d{2,3}\s*bpm\b/gi, '') // BPM anywhere
    .replace(/^\s*\d{2,3}\s+/g, (match) => {
      // Remove standalone numbers at start that look like BPM (60-200)
      const num = parseInt(match.trim(), 10)
      if (num >= 60 && num <= 200) return ''
      return match
    })
    .replace(/\b\d{2,3}\b/g, (match) => {
      // Remove standalone numbers that look like BPM (60-200)
      const num = parseInt(match, 10)
      if (num >= 60 && num <= 200) return ''
      return match
    })
  
  // Remove musical keys (more aggressive - including at start)
  name = name
    .replace(/^\s*([A-G][#b]?m?)\s+/gi, '') // Key at start
    .replace(/\b([A-G][#b]?m?)\b(?![a-z])/gi, '') // Key anywhere
  
  // Remove producer names that were extracted (case insensitive)
  if (cleanedProducers.length > 0) {
    for (const producer of cleanedProducers) {
      // Remove producer name (case insensitive, with or without @)
      const producerName = producer.replace(/^@+/, '').trim()
      if (producerName) {
        // Escape special regex characters
        const escaped = producerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Remove whole word matches (with word boundaries)
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
        name = name.replace(regex, '')
        // Also try removing if it's part of a compound (e.g., "ProducerName-BeatName")
        name = name.replace(new RegExp(`[-_\\s]*${escaped}[-_\\s]*`, 'gi'), ' ')
        // Remove @mentions format (e.g., "(@iamethanswope)" or "@iamethanswope")
        name = name.replace(new RegExp(`[@(\\s]*${escaped}[)\\s]*`, 'gi'), ' ')
      }
    }
  }
  
  // Remove @ symbols that might remain
  name = name.replace(/@+/g, '')
  
  // Remove common producer indicators that might remain
  name = name
    .replace(/\b(prod|produced|prodby|producedby|by|feat|featuring|ft|ft\.)\b/gi, '')
    .replace(/\b(x|&|and|\+)\b/gi, '') // Remove separators
    .replace(/[-_]+/g, ' ') // Replace dashes/underscores with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
  
  // Remove leading/trailing separators and clean up
  name = name
    .replace(/^[-_\s]+|[-_\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Remove parentheses and quotes
  name = name
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/["'`]/g, '') // Remove quotes (double, single, backticks)
    .replace(/\s+/g, ' ') // Collapse spaces again
    .trim()
  
  return {
    bpm: extractedBpm,
    key,
    name: name || 'Untitled Beat',
    producers: cleanedProducers,
    originalFilename: filename,
    extension: extension.toLowerCase(),
  }
}

/**
 * Validate parsed beat data
 * Returns true if beat has required information (at least producer name)
 */
export function validateParsedBeat(parsed: ParsedBeatFilename): {
  isValid: boolean
  isIncomplete: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []
  
  if (!parsed.name || parsed.name === 'Untitled Beat') {
    missingFields.push('beat name')
  }
  
  if (parsed.producers.length === 0) {
    missingFields.push('producer name')
  }
  
  const isIncomplete = missingFields.length > 0
  const isValid = !isIncomplete
  
  return {
    isValid,
    isIncomplete,
    missingFields,
  }
}

/**
 * Extract pack name from folder path
 */
export function extractPackName(folderPath: string): string {
  // Get the last folder name from the path
  const parts = folderPath.split(/[/\\]/).filter(p => p.length > 0)
  return parts[parts.length - 1] || 'Untitled Pack'
}

/**
 * Extract producer names from pack title
 * Handles formats like:
 * - "ProducerName - Pack Name"
 * - "Pack Name by ProducerName"
 * - "ProducerName x Producer2 - Pack Name"
 * - "ProducerName Pack Name"
 * - "@iamethanswope Pack Name" or "Pack Name @iamethanswope"
 */
export function extractProducersFromPackTitle(packTitle: string): {
  producers: string[]
  cleanPackName: string
} {
  if (!packTitle || packTitle.trim().length === 0) {
    return { producers: [], cleanPackName: packTitle || 'Untitled Pack' }
  }

  const title = packTitle.trim()
  const producers: string[] = []
  let cleanPackName = title

  // First, extract @mentions (these are always producers)
  const mentions = extractMentions(title)
  producers.push(...mentions)
  
  // Remove @mentions from title for further processing
  let titleWithoutMentions = title.replace(/@\w+/g, '').trim()

  // Pattern 1: "ProducerName - Pack Name" or "ProducerName x Producer2 - Pack Name"
  const dashPattern = /^(.+?)\s*-\s*(.+)$/
  const dashMatch = titleWithoutMentions.match(dashPattern)
  if (dashMatch) {
    const beforeDash = dashMatch[1].trim()
    const afterDash = dashMatch[2].trim()
    
    // Check if before dash contains producer indicators
    const producerIndicators = ['prod', 'by', 'x', '&', 'and', '+']
    const beforeLower = beforeDash.toLowerCase()
    
    if (producerIndicators.some(ind => beforeLower.includes(ind)) || 
        beforeDash.split(/[\sx&+and]+/).length <= 3) {
      // Extract producers from before dash
      const producerParts = beforeDash.split(/[\sx&+and]+/).filter(p => {
        const lower = p.toLowerCase()
        return !producerIndicators.includes(lower) && p.length > 0
      })
      producers.push(...producerParts.map(p => p.trim()).filter(p => p.length > 0))
      cleanPackName = afterDash
    }
  }

  // Pattern 2: "Pack Name by ProducerName" or "Pack Name by Producer1 x Producer2"
  if (producers.length === mentions.length) {
    const byPattern = /^(.+?)\s+by\s+(.+)$/i
    const byMatch = titleWithoutMentions.match(byPattern)
    if (byMatch) {
      cleanPackName = byMatch[1].trim()
      const afterBy = byMatch[2].trim()
      const producerParts = afterBy.split(/[\sx&+and]+/).filter(p => p.length > 0)
      producers.push(...producerParts.map(p => p.trim()))
    }
  }

  // Pattern 3: Check if title starts with common producer name patterns
  if (producers.length === mentions.length) {
    // Look for patterns like "ProducerName Pack Name" (no separator, but first word might be producer)
    const words = titleWithoutMentions.split(/\s+/)
    if (words.length >= 2) {
      // If first word looks like a producer name (short, capitalized, no numbers)
      const firstWord = words[0]
      if (firstWord.length <= 20 && /^[A-Z][a-z]+$/.test(firstWord)) {
        // Check if second word is also capitalized (likely pack name)
        if (words[1] && /^[A-Z]/.test(words[1])) {
          producers.push(firstWord)
          cleanPackName = words.slice(1).join(' ')
        }
      }
    }
  }

  // Clean up producer names
  const cleanedProducers = producers
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // Keep @mentions as-is, capitalize others
      if (p.startsWith('@')) {
        return p
      }
      // Capitalize first letter of each word
      return p.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    })
    .filter((p, i, arr) => arr.indexOf(p) === i) // Remove duplicates

  return {
    producers: cleanedProducers,
    cleanPackName: cleanPackName || titleWithoutMentions || title,
  }
}

/**
 * Remove producer names from beat name if they match pack producers
 */
export function cleanBeatNameFromPackProducers(
  beatName: string,
  packProducers: string[]
): string {
  if (!beatName || packProducers.length === 0) {
    return beatName
  }

  let cleaned = beatName

  // Remove each producer name from the beat name (case-insensitive)
  for (const producer of packProducers) {
    // Remove producer name at the start
    const startPattern = new RegExp(`^${producer}\\s*[-_x&]\\s*`, 'i')
    cleaned = cleaned.replace(startPattern, '')
    
    // Remove producer name at the end
    const endPattern = new RegExp(`\\s*[-_x&]\\s*${producer}$`, 'i')
    cleaned = cleaned.replace(endPattern, '')
    
    // Remove producer name in the middle (with separators)
    const middlePattern = new RegExp(`\\s*[-_x&]\\s*${producer}\\s*[-_x&]\\s*`, 'i')
    cleaned = cleaned.replace(middlePattern, ' ')
  }

  // Clean up extra spaces and separators
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  cleaned = cleaned.replace(/^[-_x&]\s*|\s*[-_x&]$/g, '').trim()

  return cleaned || beatName // Return original if cleaned is empty
}

