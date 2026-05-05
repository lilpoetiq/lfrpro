import { NextRequest, NextResponse } from 'next/server'

// Extract document ID from Google Docs URL
function extractDocId(url: string): string | null {
  // Handle various Google Docs URL formats:
  // https://docs.google.com/document/d/DOC_ID/edit
  // https://docs.google.com/document/d/DOC_ID/view
  // https://docs.google.com/document/d/DOC_ID
  // https://docs.google.com/document/u/0/d/DOC_ID/edit
  
  const patterns = [
    /\/document\/[^\/]+\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

// Fetch Google Docs content as plain text
async function fetchGoogleDocContent(docId: string): Promise<string | null> {
  try {
    // Try to fetch as plain text (this works for publicly shared docs)
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
    
    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    if (response.ok) {
      return await response.text()
    }
    
    // If plain text doesn't work, try HTML and extract text
    const htmlUrl = `https://docs.google.com/document/d/${docId}/export?format=html`
    const htmlResponse = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    if (htmlResponse.ok) {
      const html = await htmlResponse.text()
      // Simple HTML to text extraction (remove tags)
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    
    return null
  } catch (error) {
    console.error('Error fetching Google Doc:', error)
    return null
  }
}

// Parse UPC and ISRC from text
function parseUPCAndISRC(text: string): { upc?: string; isrc?: string } {
  const result: { upc?: string; isrc?: string } = {}
  
  // UPC patterns (12 or 13 digits)
  const upcPatterns = [
    /UPC[:\s]*([0-9]{12,13})/i,
    /UPC[:\s]*([0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4})/i,
    /\b([0-9]{12,13})\b(?=.*UPC)/i,
  ]
  
  for (const pattern of upcPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      result.upc = match[1].replace(/[-\s]/g, '')
      break
    }
  }
  
  // ISRC patterns (USRC1 followed by 9 alphanumeric, or country code + 3 letters + 7-9 digits)
  const isrcPatterns = [
    /ISRC[:\s]*([A-Z]{2}[A-Z0-9]{3}[0-9]{7,9})/i,
    /ISRC[:\s]*([A-Z]{2}[A-Z0-9]{3}[-\s]?[0-9]{7,9})/i,
    /\b([A-Z]{2}[A-Z0-9]{3}[0-9]{7,9})\b(?=.*ISRC)/i,
    /ISRC[:\s]*([A-Z0-9]{12})/i,
  ]
  
  for (const pattern of isrcPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      result.isrc = match[1].replace(/[-\s]/g, '').toUpperCase()
      break
    }
  }
  
  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const docId = extractDocId(url)
    if (!docId) {
      return NextResponse.json({ error: 'Invalid Google Docs URL' }, { status: 400 })
    }

    const content = await fetchGoogleDocContent(docId)
    if (!content) {
      return NextResponse.json({ 
        error: 'Could not fetch document. Make sure the document is publicly shared or accessible.',
        hint: 'To share: Open the document, click Share, then set access to "Anyone with the link"'
      }, { status: 404 })
    }

    const { upc, isrc } = parseUPCAndISRC(content)

    return NextResponse.json({
      success: true,
      content: content.substring(0, 1000), // Return first 1000 chars for preview
      upc,
      isrc,
      found: {
        upc: !!upc,
        isrc: !!isrc,
      },
    })
  } catch (error: any) {
    console.error('Fetch Google Doc error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Google Doc', details: error.message },
      { status: 500 }
    )
  }
}

