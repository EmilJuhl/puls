import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SpiderChart from '../components/SpiderChart'

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_COLORS = {
  1: { bg: '#fffbeb', border: '#f4b800' },
  2: { bg: '#f5f7fa', border: '#b0bec5' },
  3: { bg: '#fdf6f1', border: '#a1887f' },
}

function getWeekLabel() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 6)
  const fmt = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(now)}`
}

export default function LeaderboardPage({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [mySpider, setMySpider] = useState(null)
  const [spiderOpen, setSpiderOpen] = useState(false)

  const myId = session?.user?.id

  useEffect(() => {
    fetchLeaderboard()
    fetchMySpider()

    const channel = supabase
      .channel('scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_scores' }, () => {
        fetchLeaderboard()
        fetchMySpider()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('leaderboard_7d')
      .select('*')
      .order('rank')
    if (data) setRows(data)
    setLoading(false)
  }

  async function fetchMySpider() {
    if (!myId) return
    const { data } = await supabase
      .from('spider_chart_7d')
      .select('*')
      .eq('user_id', myId)
      .maybeSingle()
    if (data) setMySpider(data)
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1 className="page-title">Leaderboard</h1>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>7 dage</span>
        </div>
        <p className="page-subtitle">{getWeekLabel()}</p>
      </div>

      {/* Spider chart — min uge */}
      {mySpider && (
        <div style={{ padding: '0 20px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setSpiderOpen(o => !o)}
            style={{
              width: '100%',
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              border: '1.5px solid var(--border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
              🕸️ Min profil — seneste 7 dage
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
              {spiderOpen ? '▲ skjul' : '▼ vis'}
            </span>
          </button>

          {spiderOpen && (
            <div className="animate-up" style={{
              background: 'var(--card)',
              borderRadius: '0 0 var(--radius) var(--radius)',
              boxShadow: 'var(--shadow)',
              borderTop: 'none',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <SpiderChart data={mySpider} size={240} />
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map((row, i) => (
            <PlayerRow
              key={row.user_id}
              row={row}
              isMe={row.user_id === myId}
              delay={i * 40}
            />
          ))
        )}
      </div>

      <div style={{ height: '20px' }} />
    </div>
  )
}

const CAT_CHIPS = [
  { key: 'week_sleep',     label: 'Søvn',      icon: '😴' },
  { key: 'week_fysik',     label: 'Fysik',     icon: '🏋️' },
  { key: 'week_disciplin', label: 'Disciplin', icon: '📚' },
  { key: 'week_screen',    label: 'Skærm',     icon: '📵' },
  { key: 'week_hygiejne',  label: 'Hygiejne',  icon: '🦷' },
]

function PlayerRow({ row, isMe, delay }) {
  const rankStyle = RANK_COLORS[row.rank] || { bg: 'var(--card)', border: 'transparent' }

  return (
    <div
      className="animate-up"
      style={{
        background: isMe ? '#e8f5ec' : rankStyle.bg,
        borderRadius: 'var(--radius)',
        border: `2px solid ${isMe ? 'var(--g500)' : rankStyle.border}`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: isMe ? '0 0 0 3px rgba(82,183,136,0.2)' : 'var(--shadow)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
      }}
    >
      {/* Rang */}
      <div style={{ width: '28px', textAlign: 'center', flexShrink: 0 }}>
        {MEDALS[row.rank] ? (
          <span style={{ fontSize: '22px' }}>{MEDALS[row.rank]}</span>
        ) : (
          <span style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--muted)',
          }}>
            {row.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'var(--g100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
        flexShrink: 0,
      }}>
        {row.emoji_avatar}
      </div>

      {/* Navn + check-ins + kategori-chips */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700,
          fontSize: '15px',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {row.display_name}
          {isMe && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              background: 'var(--g500)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '20px',
            }}>
              dig
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <CheckDots total={7} filled={Number(row.days_checked_in)} />
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
            {row.days_checked_in}/7 dage
          </span>
        </div>
        {/* Kategori-breakdown */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          {CAT_CHIPS.map(cat => {
            const val = row[cat.key] ?? 0
            const isNeg = val < 0
            return (
              <span key={cat.key} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '20px',
                background: isNeg ? '#fdecea' : 'var(--g50)',
                color: isNeg ? '#c62828' : 'var(--muted)',
                border: `1px solid ${isNeg ? '#ef9a9a' : 'var(--border)'}`,
              }}>
                {cat.icon} {val}
              </span>
            )
          })}
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '28px',
          fontWeight: 900,
          color: row.rank === 1 ? 'var(--gold)' : 'var(--g700)',
          lineHeight: 1,
        }}>
          {row.week_score}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 500, marginTop: '2px' }}>
          Ø {row.avg_daily_score}
        </div>
      </div>
    </div>
  )
}

function CheckDots({ total, filled }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: i < filled ? 'var(--g500)' : 'var(--g100)',
          }}
        />
      ))}
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      style={{
        height: '74px',
        borderRadius: 'var(--radius)',
        background: 'var(--card)',
        opacity: 1 - i * 0.15,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  ))
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      color: 'var(--muted)',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏁</div>
      <p style={{ fontWeight: 600 }}>Ingen data endnu</p>
      <p style={{ fontSize: '13px', marginTop: '4px' }}>Vær den første til at tjekke ind!</p>
    </div>
  )
}
