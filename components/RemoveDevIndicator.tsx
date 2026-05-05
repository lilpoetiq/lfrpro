'use client'

import { useEffect } from 'react'

export default function RemoveDevIndicator() {
  useEffect(() => {
    const removeIndicator = () => {
      // Remove any fixed element in bottom-left corner
      const allElements = document.querySelectorAll('body > div')
      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        
        if (
          style.position === 'fixed' &&
          rect.left < 100 &&
          rect.bottom < 100 &&
          rect.width < 100 &&
          rect.height < 100
        ) {
          const text = el.textContent || ''
          // Remove if it contains "N" or looks like a dev indicator
          if (
            text.includes('N') ||
            text.includes('NEXT') ||
            text.trim().length < 5 ||
            el.getAttribute('data-nextjs-dev-indicator') !== null
          ) {
            el.remove()
          }
        }
      })
    }

    // Run immediately
    removeIndicator()

    // Run after a short delay to catch dynamically added elements
    const interval = setInterval(removeIndicator, 500)

    return () => clearInterval(interval)
  }, [])

  return null
}
