// SpiderChart — ren SVG radar chart, ingen eksterne biblioteker.
//
// Props:
//   data:    { sleep_pct, fysik_pct, disciplin_pct, screen_pct, hygiejne_pct }
//   dataB:   (valgfri) samme struktur — tegner et andet polygon til sammenligning
//   size:    number (standard 220)
//   color:   streng (fyldfarve, standard grøn)
//   colorB:  streng (fyldfarve for dataB, standard orange)
//   nameB:   streng (navn til legend for dataB)

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

export default function SpiderChart({
  data,
  dataB = null,
  size = 220,
  color = '#2d6a4f',
  colorB = '#e76f51',
  nameB = null,
}) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.36
  const labelR = maxR + 22

  const values  = AXES.map(a => data?.[a.key]  ?? 0)
  const valuesB = dataB ? AXES.map(a => dataB?.[a.key] ?? 0) : null

  const dataPoints  = polyPoints(cx, cy, maxR, values)
  const dataBPoints = valuesB ? polyPoints(cx, cy, maxR, valuesB) : null

  const ringPolygons = RINGS.map(pct =>
    AXES.map((_, i) => {
      const r = (pct / 100) * maxR
      const p = point(cx, cy, r, i, N)
      return `${p.x},${p.y}`
    }).join(' ')
  )

  return (
    <div style={{ display: 'inline-block' }}>
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

        {/* DataB polygon (sammenligningsspiller) — tegnes FØR A så A er øverst */}
        {valuesB && (
          <>
            <polygon
              points={dataBPoints}
              fill={colorB}
              fillOpacity={0.15}
              stroke={colorB}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray="5,3"
            />
            {valuesB.map((v, i) => {
              const r = (Math.max(0, Math.min(100, v)) / 100) * maxR
              const p = point(cx, cy, r, i, N)
              return (
                <circle
                  key={`b-${i}`}
                  cx={p.x} cy={p.y}
                  r={3.5}
                  fill={colorB}
                  stroke="white"
                  strokeWidth={1.5}
                />
              )
            })}
          </>
        )}

        {/* Data A polygon (primær spiller) */}
        <polygon
          points={dataPoints}
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data A punkter */}
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

      {/* Legend — vises kun ved sammenligning */}
      {dataB && nameB && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginTop: '8px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
            <span style={{ color: 'var(--text)' }}>Dig</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: colorB, opacity: 0.85,
            }} />
            <span style={{ color: 'var(--text)' }}>{nameB}</span>
          </div>
        </div>
      )}
    </div>
  )
}
