'use client'

import { useEffect } from 'react'

export default function RemoveWebpackIndicator() {
  useEffect(() => {
    const removeIndicator = () => {
      // Remove by various selectors - COMPREHENSIVE
      const selectors = [
        '#__next-build-watcher',
        '#__next-dev-overlay',
        '[data-nextjs-toast]',
        '[data-nextjs-dialog]',
        '.nextjs-toast-root',
        '#__next-dev-overlay-container',
        '.__webpack-dev-server-client-overlay__',
        'iframe[src*="webpack"]',
        'iframe[src*="__webpack"]',
        'iframe[src*="next-dev"]',
        'iframe[src*="hmr"]',
        '[id^="__webpack"]',
        '[class^="__webpack"]',
        '[id*="webpack"]',
        '[class*="webpack"]',
        '[id*="hmr"]',
        '[class*="hmr"]',
        '[id*="next-dev"]',
        '[class*="next-dev"]',
      ]
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector)
          elements.forEach(el => {
            if (el) {
              el.remove()
              if (el.parentNode) {
                el.parentNode.removeChild(el)
              }
            }
          })
        } catch (e) {
          // Ignore errors
        }
      })
      
      // Remove ALL fixed position elements in bottom-left corner (aggressive)
      const allElements = document.querySelectorAll('*')
      allElements.forEach(el => {
        try {
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          
          // Check if it's in bottom-left corner
          if (
            style.position === 'fixed' &&
            rect.bottom <= 100 &&
            rect.left <= 100 &&
            rect.width <= 300 &&
            rect.height <= 300
          ) {
            // Check if it's likely a dev indicator
            const id = (el.id || '').toLowerCase()
            const className = (el.className || '').toLowerCase()
            const text = (el.textContent || '').toLowerCase()
            const tagName = el.tagName.toLowerCase()
            
            // Remove iframes in bottom-left
            if (tagName === 'iframe' && rect.bottom <= 50 && rect.left <= 50) {
              el.remove()
              return
            }
            
            // Remove if it matches webpack/dev indicators
            if (
              id.includes('webpack') ||
              id.includes('next') ||
              id.includes('dev') ||
              id.includes('hmr') ||
              id.includes('build') ||
              id.includes('watcher') ||
              className.includes('webpack') ||
              className.includes('next') ||
              className.includes('dev') ||
              className.includes('hmr') ||
              className.includes('build') ||
              className.includes('watcher') ||
              text.includes('webpack') ||
              text.includes('hmr') ||
              text.includes('fast refresh') ||
              text.includes('compiling') ||
              text.includes('ready')
            ) {
              el.remove()
            }
          }
        } catch (e) {
          // Ignore errors
        }
      })
      
      // Also remove from head
      try {
        const headScripts = document.head.querySelectorAll('script')
        headScripts.forEach(script => {
          const src = script.src || ''
          const content = script.textContent || ''
          if (
            src.includes('webpack') ||
            src.includes('hmr') ||
            content.includes('webpack') ||
            content.includes('__webpack') ||
            content.includes('hmr')
          ) {
            script.remove()
          }
        })
      } catch (e) {
        // Ignore
      }
    }
    
    // Run immediately
    removeIndicator()
    
    // Run multiple times with delays
    const delays = [50, 100, 200, 500, 1000, 2000]
    delays.forEach(delay => {
      setTimeout(removeIndicator, delay)
    })
    
    // Set up observer to catch dynamically added elements
    const observer = new MutationObserver(() => {
      removeIndicator()
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'id'],
    })
    
    observer.observe(document.head, {
      childList: true,
      subtree: true,
    })
    
    // Check very frequently
    const interval = setInterval(removeIndicator, 100)
    
    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])
  
  return null
}
