'use client'

interface LFRLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'text' | 'icon' | 'full'
}

export default function LFRLogo({ size = 'md', className = '', variant = 'full' }: LFRLogoProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-base',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }

  const logoText = 'LEGENDARY FYRE RECORDS'
  
  // Split into words for styling
  const words = logoText.split(' ')

  if (variant === 'icon') {
    return (
      <div className={`font-bold text-red-600 ${sizeClasses[size]} ${className}`}>
        LFR
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className={`font-bold text-white ${sizeClasses[size]} ${className}`}>
        {logoText}
      </div>
    )
  }

  // Full variant with styled text - aggressive, distressed style
  return (
    <div className={`font-black text-white ${sizeClasses[size]} ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        {words.map((word, idx) => (
          <span
            key={idx}
            className="inline-block transform"
            style={{
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              fontWeight: 900,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textShadow: '3px 3px 6px rgba(0,0,0,0.8), 0 0 10px rgba(220,38,38,0.3)',
              filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.9))',
              WebkitTextStroke: '0.5px rgba(0,0,0,0.3)',
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  )
}

