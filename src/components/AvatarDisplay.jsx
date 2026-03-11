// AvatarDisplay — ren SVG gaming-avatar renderer.
// Ingen eksterne dependencies. Inline SVG paths for alle ikoner.
//
// Props:
//   avatarConfig: JSONB objekt med shape, bgColor1/2, icon, borderColor, borderStyle, badge
//   emojiAvatar:  fallback emoji hvis avatarConfig er null
//   size:         pixel-størrelse (standard 48)

const ICON_PATHS = {
  sword: 'M3 21l7-7m0 0l8-8-4-4-8 8m0 0l-3 3',
  skull: 'M12 2C8.1 2 5 5.1 5 9c0 2.4 1.1 4.5 2.9 5.9V17h8v-2.1C17.9 13.5 19 11.4 19 9c0-3.9-3.1-7-7-7zm-2 15h4v1a2 2 0 01-4 0v-1z',
  lightning: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  crown: 'M2 19l2-7 4 3 4-8 4 8 4-3 2 7H2z',
  snake: 'M12 2C9 2 7 4 7 7s2 3 2 6c0 2-1 3-3 3h-1m8-14c3 0 5 2 5 5s-2 3-2 6c0 2 1 3 3 3h1',
  eagle: 'M12 2l-2 6H4l5 4-2 6 5-3 5 3-2-6 5-4h-6z',
  flame: 'M12 2C8 6 6 9 8 13c-2-1-3-3-3-5C3 12 2 15 4 18c2 4 7 6 8 6s6-2 8-6c2-3 1-6-1-9-1 2-3 4-5 4 2-4 0-8-2-11z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 100-6 3 3 0 000 6z',
  wolf: 'M4 6l2 4-4 3h4l2 7 4-5 4 5 2-7h4l-4-3 2-4-6 2z',
}

const SHAPES = {
  circle: null,
  hexagon: '50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5',
  diamond: '50,5 95,50 50,95 5,50',
  shield: '50,5 95,30 95,65 50,95 5,65 5,30',
  skull: '30,15 70,15 85,40 80,65 70,75 65,90 50,95 35,90 30,75 20,65 15,40',
}

const BADGE_COLORS = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
}

export default function AvatarDisplay({ avatarConfig, emojiAvatar = '🔥', size = 48 }) {
  if (!avatarConfig) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--g100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        flexShrink: 0,
      }}>
        {emojiAvatar}
      </div>
    )
  }

  const {
    shape = 'circle',
    bgColor1 = '#2d6a4f',
    bgColor2 = '#52b788',
    icon = 'flame',
    borderColor = '#2d6a4f',
    borderStyle = 'solid',
    badge = null,
  } = avatarConfig

  const uid = `av-${Math.random().toString(36).slice(2, 8)}`
  const gradId = `grad-${uid}`
  const clipId = `clip-${uid}`

  // Border / glow styling
  let containerStyle = {
    width: size,
    height: size,
    position: 'relative',
    flexShrink: 0,
    display: 'inline-block',
  }

  const isNeon = borderStyle === 'neon'

  if (isNeon) {
    containerStyle = {
      ...containerStyle,
      filter: `drop-shadow(0 0 ${size * 0.12}px ${borderColor}) drop-shadow(0 0 ${size * 0.06}px ${borderColor})`,
    }
  }

  const strokeWidth = Math.max(2, size * 0.05)
  const isDouble = borderStyle === 'double'

  const iconPath = ICON_PATHS[icon] || ICON_PATHS.flame
  const iconSize = size * 0.42
  const iconOffset = (size - iconSize) / 2
  const viewScale = iconSize / 24

  const polygonPoints = shape !== 'circle' ? SHAPES[shape] : null

  return (
    <div style={containerStyle}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={bgColor1} />
            <stop offset="100%" stopColor={bgColor2} />
          </linearGradient>
          <clipPath id={clipId}>
            {shape === 'circle'
              ? <circle cx="50" cy="50" r="47" />
              : <polygon points={polygonPoints} />
            }
          </clipPath>
        </defs>

        {/* Bakground */}
        {shape === 'circle'
          ? <circle cx="50" cy="50" r="47" fill={`url(#${gradId})`} />
          : <polygon points={polygonPoints} fill={`url(#${gradId})`} />
        }

        {/* Ikon */}
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(${(100 - iconSize) / 2}, ${(100 - iconSize) / 2}) scale(${viewScale})`}>
            <path
              d={iconPath}
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={2.5 / viewScale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* Border */}
        {shape === 'circle' ? (
          <>
            <circle
              cx="50" cy="50" r="47"
              fill="none"
              stroke={borderColor}
              strokeWidth={strokeWidth}
              strokeDasharray={borderStyle === 'dashed' ? '8,4' : undefined}
            />
            {isDouble && (
              <circle
                cx="50" cy="50" r={47 - strokeWidth - 2}
                fill="none"
                stroke={borderColor}
                strokeWidth={strokeWidth * 0.6}
                strokeOpacity={0.6}
              />
            )}
          </>
        ) : (
          <>
            <polygon
              points={polygonPoints}
              fill="none"
              stroke={borderColor}
              strokeWidth={strokeWidth}
              strokeDasharray={borderStyle === 'dashed' ? '8,4' : undefined}
              strokeLinejoin="round"
            />
            {isDouble && (
              <polygon
                points={polygonPoints}
                fill="none"
                stroke={borderColor}
                strokeWidth={strokeWidth * 0.6}
                strokeOpacity={0.6}
                strokeLinejoin="round"
                transform={`scale(0.92) translate(4, 4)`}
              />
            )}
          </>
        )}

        {/* Badge */}
        {badge && BADGE_COLORS[badge] && (
          <>
            <circle cx="78" cy="78" r="14" fill={BADGE_COLORS[badge]} stroke="white" strokeWidth="2" />
            <text x="78" y="83" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="system-ui">
              {badge === 'bronze' ? 'B' : badge === 'silver' ? 'S' : 'G'}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
