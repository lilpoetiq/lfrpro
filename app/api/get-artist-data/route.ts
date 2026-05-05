import { NextRequest, NextResponse } from 'next/server'
import { getArtistData, getUploads, getUsers, getCatalog, getArtistUserMappings } from '@/lib/storage'
import { cleanSongName } from '@/lib/utils'
import { matchArtistsToUsers, parseArtistsFromString } from '@/lib/artistParser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistName = searchParams.get('artist')

    if (!artistName) {
      return NextResponse.json({ error: 'Artist name required' }, { status: 400 })
    }

    const artistFileData = getArtistData(artistName)
    const uploads = getUploads()
    const users = getUsers()
    const catalog = getCatalog()
    
    // Get manual mappings
    const mappings = getArtistUserMappings()
    const manualMappings: Record<string, string> = {}
    mappings.forEach(m => {
      manualMappings[m.artistName.toLowerCase()] = m.userId
    })
    
    // Match artist name to user ID(s) to find collaborative songs
    const artistUserIds = matchArtistsToUsers([artistName], users, manualMappings)
    
    const artistData: any[] = []
    const songs = new Map<string, any>()

    // FIRST: Process catalog songs (catalog is source of truth for released songs)
    // This prevents double counting when same song exists in CSV and catalog
    if (artistUserIds.length > 0) {
      catalog.forEach((item) => {
        // Skip pending and denied items - only show approved/released songs
        if (item.releaseApprovalStatus === 'pending' || item.releaseApprovalStatus === 'denied') return
        
        const itemArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
        
        // Check if this artist's user ID is in the collaboration
        const isCollaborator = artistUserIds.some(userId => itemArtistIds.includes(userId))
        
        // Also check by artist name
        const itemArtists = parseArtistsFromString(item.artist)
        const normalizedArtistName = artistName.toLowerCase().trim()
        const isArtistInItem = itemArtists.some(a => a.toLowerCase().trim() === normalizedArtistName)
        
        if (isCollaborator || isArtistInItem) {
          // Add catalog item to artist data
          artistData.push({
            song: item.song,
            artist: item.artist,
            totalStreams: item.totalStreams || 0,
            distributor: item.distributor || 'Unknown',
            upc: item.upc || '',
            isrc: item.isrc || '',
            googleDriveUrl: item.googleDriveUrl || '',
            fromCatalog: true,
            catalogId: item.id,
            releaseType: item.releaseType,
            releaseDate: item.releaseDate,
          })
          
          // Add or merge song entry (catalog is source of truth)
          const songName = cleanSongName(item.song)
          if (songName) {
            songs.set(songName, {
              name: songName,
              streams: item.totalStreams || 0, // Use catalog streams (source of truth)
              platforms: new Set<string>(),
              uploads: [],
              googleDriveUrl: item.googleDriveUrl || '',
              upc: item.upc || '',
              isrc: item.isrc || '',
              fromCatalog: true,
            })
            
            const song = songs.get(songName)!
            
            // Add distributor/platform
            if (item.distributor) {
              song.platforms.add(item.distributor)
            } else if (item.platforms && item.platforms.length > 0) {
              item.platforms.forEach((platform: string) => song.platforms.add(platform))
            } else {
              song.platforms.add('Catalog')
            }
          }
          
          // Handle EP/Album songs
          if (item.songs && item.songs.length > 0) {
            item.songs.forEach((subSong: any) => {
              const subSongName = cleanSongName(subSong.song)
              if (subSongName) {
                songs.set(subSongName, {
                  name: subSongName,
                  streams: subSong.streams || 0, // Use catalog streams (source of truth)
                  platforms: new Set<string>(),
                  uploads: [],
                  googleDriveUrl: item.googleDriveUrl || '',
                  upc: item.upc || '',
                  isrc: subSong.isrc || item.isrc || '',
                  fromCatalog: true,
                })
                
                const subSongEntry = songs.get(subSongName)!
                
                if (item.distributor) {
                  subSongEntry.platforms.add(item.distributor)
                } else if (item.platforms && item.platforms.length > 0) {
                  item.platforms.forEach((platform: string) => subSongEntry.platforms.add(platform))
                } else {
                  subSongEntry.platforms.add('Catalog')
                }
              }
            })
          }
        }
      })
    }

    // SECOND: Process CSV uploads - only add songs that DON'T exist in catalog
    // This prevents double counting (catalog is source of truth for released songs)
    uploads.forEach((upload) => {
      if (upload.groupedByArtist && upload.groupedByArtist[artistName]) {
        upload.groupedByArtist[artistName].forEach((row: any) => {
          let songName = row._parsedSong || row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title
          songName = cleanSongName(songName || '')
          if (songName) {
            // Only add CSV data if song doesn't exist in catalog
            // Catalog is the source of truth for released songs
            if (!songs.has(songName)) {
              artistData.push({
                ...row,
                uploadId: upload.id,
                uploadedAt: upload.uploadedAt,
                fromCatalog: false,
              })
              
              const parseNumber = (value: any): number => {
                if (!value || value === '') return 0
                if (typeof value === 'number') return value
                const cleaned = String(value).replace(/,/g, '').trim()
                const parsed = parseInt(cleaned)
                return isNaN(parsed) ? 0 : parsed
              }
              
              // Calculate total streams - sum ALL Total columns (Total, Total_1, Total_2, etc.)
              let streams = 0
              Object.keys(row).forEach((key) => {
                if (key === 'Total' || key.startsWith('Total_')) {
                  streams += parseNumber(row[key])
                }
              })
              
              // If no Total columns found, sum individual platform columns
              if (streams === 0) {
                const platformKeywords = [
                  'youtube', 'yt', 'you tube',
                  'spotify', 'spot',
                  'apple', 'apple music', 'itunes',
                  'soundcloud', 'sc',
                  'tidal',
                  'amazon', 'amazon music',
                  'deezer',
                  'pandora',
                  'iheartradio', 'iheart',
                  'tiktok', 'tik tok',
                  'instagram', 'ig',
                  'facebook', 'fb',
                  'twitter', 'tw',
                  'streams', 'plays', 'views', 'listens'
                ]
                
                // Sum all platform-specific columns
                Object.keys(row).forEach((key) => {
                  const keyLower = key.toLowerCase().trim()
                  
                  // Skip non-numeric columns
                  if (keyLower.includes('song') || keyLower.includes('artist') || 
                      keyLower.includes('title') || keyLower.includes('name') ||
                      keyLower.includes('date') || keyLower.includes('time') ||
                      keyLower.includes('url') || keyLower.includes('link') ||
                      keyLower.includes('upc') || keyLower.includes('isrc') ||
                      keyLower.includes('distributor') || keyLower.includes('platform')) {
                    return
                  }
                  
                  // Check if this looks like a platform column or numeric column
                  const isPlatformColumn = platformKeywords.some(keyword => keyLower.includes(keyword))
                  const value = row[key]
                  
                  // If it's a platform column or a numeric value, add it
                  if (isPlatformColumn || (typeof value === 'number' && value > 0) || 
                      (typeof value === 'string' && /^\d+[,\d]*$/.test(value.replace(/,/g, '')))) {
                    const numValue = parseNumber(value)
                    if (numValue > 0) {
                      streams += numValue
                    }
                  }
                })
              }
              
              // Final fallback: try standard streams column
              if (streams === 0) {
                streams = parseNumber(row.streams || row.Streams || row.STREAMS || row.Total || row.total || row.TOTAL)
              }
              
              const platform = row.platform || row.Platform || row.PLATFORM || row.distributor || row.Distributor || 'Unknown'
              songs.set(songName, {
                name: songName,
                streams: streams,
                platforms: new Set<string>([platform]),
                uploads: [upload.id],
                googleDriveUrl: row.googleDriveUrl || row.drive || row['Google Drive'] || row['google_drive'] || '',
                upc: row.upc || row.UPC || row.Upc || row['UPC Code'] || '',
                isrc: row.isrc || row.ISRC || row.Isrc || row['ISRC Code'] || '',
                fromCatalog: false,
              })
            }
            // If song exists in catalog, skip CSV data (catalog is source of truth)
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      artist: artistName,
      totalRows: artistData.length,
      songs: Array.from(songs.values()).map(song => ({
        ...song,
        platforms: Array.from(song.platforms),
      })),
      data: artistData,
    })
  } catch (error: any) {
    console.error('Get artist data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch artist data', details: error.message },
      { status: 500 }
    )
  }
}
