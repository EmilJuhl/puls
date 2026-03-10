// SpiderChart — ren SVG radar chart, ingen eksterne biblioteker.
//
// Props:
//   data: { sleep_pct, fysik_pct, disciplin_pct, screen_pct, hygiejne_pct, social_pct }
//   size: number (standard 220)
//   color: streng (fyldfarve, standard grøn)

const AXES = [
  { key: 'sleep_pct',     label: 'Søvn',      icon: '😴' },
  { key: 'fysik_pct',     label: 'Fysik',     icon: '🏋️' },
  { key: 'hygiejne_pct',  label: 'Hygiejne',  icon: '🦷' },
  { key: 'screen_pct',    label: 'Skærm',     icon: '📵' },
  { key: 'disciplin_pct', label: 'Disciplin', icon: '📚' },
]

const N = AXES.length
const RINGS = [25, 50, 75, 100]

// Beregn (x, y) for en given akse-index og radius
function point(cx, cy, r, i, total) {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

function polyPoints(cx, cy, maxR, values) {
  return values
    .map((v, i) => {
      const r = (Math.max(0, Math.min(100, v)) / 100) * maxR
      const p = point(cx, cy, r, i, values.length)
      return `${p.x},${p.y}`
    })
    .join(' ')
}

export default function SpiderChart({ data, size = 220, color = '#2d6a4f' }) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.36 // lader plads til labels
  const labelR = maxR + 22  // radius til label-placering

  const values = AXES.map(a => data?.[a.key] ?? 0)

  // Polygon-punkter for dataprofil
  const dataPoints = polyPoints(cx, cy, maxR, values)

  // Polygon-punkter for hvert ring-niveau
  const ringPolygons = RINGS.map(pct =>
    AXES.map((_, i) => {
      const r = (pct / 100) * maxR
      const p = point(cx, cy, r, i, N)
      return `${p.x},${p.y}`
    }).join(' ')
  )

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      {/* Baggrunds-ringe */}
      {ringPolygons.map((pts, ri) => (
        <polygon
          key={ri}
          points={pts}
          fill="none"
          stroke={ri === ringPolygons.length - 1 ? '#b7dfc9' : '#e8f5ec'}
          strokeWidth={ri === ringPolygons.length - 1 ? 1.5 : 1}
        />
      ))}

      {/* Akse-linjer fra centrum til ydre ring */}
      {AXES.map((_, i) => {
        const outer = point(cx, cy, maxR, i, N)
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={outer.x} y2={outer.y}
            stroke="#d4edda"
            strokeWidth={1}
          />
        )
      })}

      {/* Dataprofil — fyld */}
      <polygon
        points={dataPoints}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Datapunkter */}
      {values.map((v, i) => {
        const r = (Math.max(0, Math.min(100, v)) / 100) * maxR
        const p = point(cx, cy, r, i, N)
        return (
          <circle
            key={i}
            cx={p.x} cy={p.y}
            r={4}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
          />
        )
      })}

      {/* Labels */}
      {AXES.map((axis, i) => {
        const p = point(cx, cy, labelR, i, N)
        // Tekstanchor afhænger af position
        const anchor = p.x < cx - 5 ? 'end' : p.x > cx + 5 ? 'start' : 'middle'
        const dyBase = p.y < cy - 5 ? -6 : p.y > cy + 5 ? 14 : 4
        const val = values[i]

        return (
          <g key={i}>
            <text
              x={p.x}
              y={p.y + dyBase - 10}
              textAnchor={anchor}
              fontSize="9"
              fontWeight="600"
              fill="#6b7280"
              fontFamily="system-ui, sans-serif"
            >
              {axis.icon} {axis.label}
            </text>
            <text
              x={p.x}
              y={p.y + dyBase + 1}
              textAnchor={anchor}
              fontSize="10"
              fontWeight="700"
              fill={color}
              fontFamily="system-ui, sans-serif"
            >
              {val}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
