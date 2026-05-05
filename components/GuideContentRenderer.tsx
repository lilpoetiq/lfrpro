'use client'

import { useMemo } from 'react'
import Image from 'next/image'

interface GuideContentRendererProps {
  content: string
}

export default function GuideContentRenderer({ content }: GuideContentRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null

    // Split content into lines to process
    const lines = content.split('\n')
    const elements: JSX.Element[] = []
    let key = 0

    lines.forEach((line, lineIndex) => {
      // Check for markdown-style images: ![alt](url)
      const imageMarkdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
      const imageMatches = Array.from(line.matchAll(imageMarkdownRegex))

      if (imageMatches.length > 0) {
        // Process line with images
        let lastIndex = 0
        const lineElements: JSX.Element[] = []

        imageMatches.forEach((match) => {
          // Add text before image
          if (match.index !== undefined && match.index > lastIndex) {
            const textBefore = line.substring(lastIndex, match.index)
            if (textBefore.trim()) {
              lineElements.push(
                <span key={`text-${key++}`}>{renderTextWithLinks(textBefore)}</span>
              )
            }
          }

          // Add image
          const altText = match[1] || 'Guide image'
          const imageUrl = match[2]
          lineElements.push(
            <div key={`img-${key++}`} className="my-4">
              <img
                src={imageUrl}
                alt={altText}
                className="max-w-full h-auto rounded-lg border border-slate-700"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>
          )

          lastIndex = (match.index || 0) + match[0].length
        })

        // Add remaining text after last image
        if (lastIndex < line.length) {
          const textAfter = line.substring(lastIndex)
          if (textAfter.trim()) {
            lineElements.push(
              <span key={`text-${key++}`}>{renderTextWithLinks(textAfter)}</span>
            )
          }
        }

        elements.push(
          <div key={`line-${lineIndex}`} className="mb-2">
            {lineElements}
          </div>
        )
      } else {
        // Check for direct image URLs (http/https URLs ending in image extensions)
        const imageUrlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?)/gi
        const urlMatches = Array.from(line.matchAll(imageUrlRegex))

        if (urlMatches.length > 0 && line.trim().length < 200) {
          // Likely an image URL line
          urlMatches.forEach((match) => {
            elements.push(
              <div key={`img-${key++}`} className="my-4">
                <img
                  src={match[0]}
                  alt="Guide image"
                  className="max-w-full h-auto rounded-lg border border-slate-700"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              </div>
            )
          })
        } else {
          // Regular text line with links
          elements.push(
            <div key={`line-${lineIndex}`} className="mb-2">
              {renderTextWithLinks(line)}
            </div>
          )
        }
      }
    })

    return elements
  }, [content])

  return <div className="guide-content">{renderedContent}</div>
}

// Helper function to render text with clickable links
function renderTextWithLinks(text: string): JSX.Element[] {
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    // Add clickable link
    const url = match[0]
    parts.push(
      <a
        key={`link-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline break-all"
        onClick={(e) => {
          e.stopPropagation() // Prevent parent click handlers
        }}
      >
        {url}
      </a>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  // If no links found, return text as-is
  if (parts.length === 0) {
    return [<span key="text">{text}</span>]
  }

  return parts.map((part, index) => {
    if (typeof part === 'string') {
      return <span key={`part-${index}`}>{part}</span>
    }
    return part
  })
}
