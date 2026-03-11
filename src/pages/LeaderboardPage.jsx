import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SpiderChart from '../components/SpiderChart'
import AvatarDisplay from '../components/AvatarDisplay'

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_COLORS = {
  1: { bg: '#fffbeb', border: '#f4b800' },
  2: { bg: '#f5f7fa', border: '#b0bec5' },
  3: { bg: '#fdf6f1', border: '#a1887f' },
}

function getDateStr(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

function getPeriodLabel(tab) {
  const now = new Date()
  const fmt = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  if (tab === 'dag') return fmt(now)
  if (tab === 'uge') {
    const start = new Date(now); start.setDate(now.getDate() - 6)
    return `${fmt(start)} – ${fmt(now)}`
  }
  const start = new Date(now); start.setDate(now.getDate() - 29)
  return `${fmt(start)} – ${fmt(now)}`
}

const LEADERBOARD_TABS = [
  { id: 'dag',    label: 'Dag' },
  { id: 'uge',    label: 'Uge' },
  { id: 'maaned', label: 'Måned' },
]

// Kategori-chips konfigureret per tab
const CAT_KEYS = {
  dag:    { sleep: 'day_sleep',     fysik: 'day_fysik',     disciplin: 'day_disciplin',     screen: 'day_screen',     hygiejne: 'day_hygiejne',     score: 'day_score' },
  uge:    { sleep: 'week_sleep',    fysik: 'week_fysik',    disciplin: 'week_disciplin',    screen: 'week_screen',    hygiejne: 'week_hygiejne',    score: 'week_score' },
  maaned: { sleep: 'month_sleep',   fysik: 'month_fysik',   disciplin: 'month_disciplin',   screen: 'month_screen',   hygiejne: 'month_hygiejne',   score: 'month_score' },
}

const CAT_ICONS = [
  { cat: 'sleep',     label: 'Søvn',      icon: '😴' },
  { cat: 'fysik',     label: 'Fysik',     icon: '🏋️' },
  { cat: 'disciplin', label: 'Disciplin', icon: '📚' },
  { cat: 'screen',    label: 'Skærm',     icon: '📵' },
  { cat: 'hygiejne',  label: 'Hygiejne',  icon: '🦷' },
]

const TODAY = getDateStr(0)

export default function LeaderboardPage({ session }) {
  const [leaderTab, setLeaderTab] = useState('uge')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [mySpider, setMySpider] = useState(null)
  const [spiderOpen, setSpiderOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [compareId, setCompareId] = useState(null)
  const [compareSpider, setCompareSpider] = useState(null)
  const [compareName, setCompareName] = useState('')
  const [achievements, setAchievements] = useState({}) // Map: userId → achievement[]

  const myId = session?.user?.id

  useEffect(() => {
    fetchLeaderboard()
    fetchMySpider()
    fetchAllAchievements()

    const channel = supabase
      .channel('scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_scores' }, () => {
        fetchLeaderboard()
        fetchMySpider()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    setLoading(true)
    setExpandedId(null)
    fetchLeaderboard()
  }, [leaderTab])

  useEffect(() => {
    if (!compareId) { setCompareSpider(null); return }
    supabase
      .from('spider_chart_7d')
      .select('*')
      .eq('user_id', compareId)
      .maybeSingle()
      .then(({ data }) => { if (data) setCompareSpider(data) })
  }, [compareId])

  async function fetchLeaderboard() {
    const viewMap = { dag: 'leaderboard_today', uge: 'leaderboard_7d', maaned: 'leaderboard_30d' }
    const { data } = await supabase
      .from(viewMap[leaderTab])
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

  async function fetchAllAchievements() {
    const { data } = await supabase
      .from('user_achievements')
      .select('user_id, achievement_id, achievements(icon, is_positive, name)')
    if (!data) return
    const map = {}
    data.forEach(ua => {
      if (!map[ua.user_id]) map[ua.user_id] = []
      map[ua.user_id].push(ua.achievements)
    })
    setAchievements(map)
  }

  function handleCompare(row) {
    setCompareId(row.user_id)
    setCompareName(row.display_name)
    setExpandedId(null)
  }

  const dotsTotal = leaderTab === 'dag' ? 1 : leaderTab === 'uge' ? 7 : 30

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>

        {/* Tab-bar */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginTop: '12px',
          background: 'var(--g50)',
          borderRadius: '12px',
          padding: '4px',
        }}>
          {LEADERBOARD_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setLeaderTab(t.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                background: leaderTab === t.id ? 'var(--g700)' : 'transparent',
                color: leaderTab === t.id ? 'white' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="page-subtitle" style={{ marginTop: '8px' }}>
          {getPeriodLabel(leaderTab)}
        </p>
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
              borderRadius: spiderOpen ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
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
              leaderTab={leaderTab}
              dotsTotal={dotsTotal}
              expanded={expandedId === row.user_id}
              onExpand={() => setExpandedId(expandedId === row.user_id ? null : row.user_id)}
              onCompare={() => handleCompare(row)}
              userAchievements={achievements[row.user_id] || []}
            />
          ))
        )}
      </div>

      <div style={{ height: '20px' }} />

      {/* Sammenlign overlay */}
      {compareId && compareSpider && mySpider && (
        <CompareOverlay
          mySpider={mySpider}
          compareSpider={compareSpider}
          compareName={compareName}
          onClose={() => { setCompareId(null); setCompareSpider(null) }}
        />
      )}
    </div>
  )
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

function PlayerRow({ row, isMe, delay, leaderTab, dotsTotal, expanded, onExpand, onCompare, userAchievements }) {
  const rankStyle = RANK_COLORS[row.rank] || { bg: 'var(--card)', border: 'transparent' }
  const keys = CAT_KEYS[leaderTab]
  const scoreVal = row[keys.score] ?? 0

  // Vis kun positive achievements på leaderboard (max 3)
  const publicAchievements = userAchievements
    .filter(a => a.is_positive)
    .slice(0, 3)

  return (
    <div
      className="animate-up"
      style={{
        background: isMe ? '#e8f5ec' : rankStyle.bg,
        borderRadius: 'var(--radius)',
        border: `2px solid ${isMe ? 'var(--g500)' : rankStyle.border}`,
        boxShadow: isMe ? '0 0 0 3px rgba(82,183,136,0.2)' : 'var(--shadow)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
        overflow: 'hidden',
      }}
    >
      {/* Hoved-række */}
      <div
        onClick={onExpand}
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
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
        <AvatarDisplay
          avatarConfig={row.avatar_config}
          emojiAvatar={row.emoji_avatar}
          size={42}
        />

        {/* Navn + chips */}
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
            <CheckDots total={dotsTotal} filled={Number(row.days_checked_in)} />
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
              {row.days_checked_in}/{dotsTotal} dage
            </span>
          </div>

          {/* Kategori-chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
            {CAT_ICONS.map(cat => {
              const val = row[keys[cat.cat]] ?? 0
              const isNeg = val < 0
              return (
                <span key={cat.cat} style={{
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

          {/* Achievement-badges */}
          {publicAchievements.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {publicAchievements.map(a => (
                <span key={a.name} title={a.name} style={{ fontSize: '14px' }}>{a.icon}</span>
              ))}
            </div>
          )}
        </div>

        {/* Score + sammenlign-knap */}
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '28px',
            fontWeight: 900,
            color: row.rank === 1 ? 'var(--gold)' : 'var(--g700)',
            lineHeight: 1,
          }}>
            {scoreVal}
          </div>
          {leaderTab !== 'dag' && (
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 500 }}>
              Ø {row.avg_daily_score}
            </div>
          )}
          {!isMe && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onCompare() }}
              style={{
                marginTop: '4px',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--g700)',
                background: 'var(--g50)',
                border: '1px solid var(--g300)',
                borderRadius: '8px',
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              Sammenlign
            </button>
          )}
        </div>
      </div>

      {/* Expanded check-in detaljer */}
      {expanded && leaderTab === 'dag' && (
        <CheckinDetail userId={row.user_id} />
      )}
    </div>
  )
}

// ─── CheckinDetail ────────────────────────────────────────────────────────────

function CheckinDetail({ userId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('date', TODAY)
      .maybeSingle()
      .then(({ data: d }) => {
        setData(d)
        setLoading(false)
      })
  }, [userId])

  if (loading) {
    return (
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: '13px' }}>
        Henter data…
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: '13px' }}>
        Ingen check-in i dag endnu
      </div>
    )
  }

  const sections = [
    {
      icon: '😴', title: 'Søvn',
      fields: [
        { label: 'Timer', value: `${data.sleep_hours}t` },
        { label: 'Konsistent', value: data.sleep_consistent ? 'Ja' : 'Nej' },
      ],
    },
    {
      icon: '🏋️', title: 'Fysik',
      fields: [
        { label: 'Skridt', value: data.steps?.toLocaleString('da-DK') },
        { label: 'Styrke', value: `${data.strength_minutes}min` },
        { label: 'Cardio', value: `${data.cardio_minutes}min` },
      ],
    },
    {
      icon: '📚', title: 'Disciplin',
      fields: [
        { label: 'Lektier', value: data.homework_done ? '✓' : '✗' },
        { label: 'Til tiden', value: data.on_time ? '✓' : '✗' },
        { label: 'Læsning', value: `${data.reading_minutes}min` },
        { label: 'Tjente', value: data.earned_money ? '✓' : '✗' },
        { label: 'Sparet', value: data.saved_money ? '✓' : '✗' },
        { label: 'Skippet', value: data.skipped_class ? '⚠️ Ja' : 'Nej' },
      ],
    },
    {
      icon: '📵', title: 'Skærm',
      fields: [
        { label: 'Skærm', value: `${data.passive_screen_hours}t` },
        { label: 'Doomscroll', value: `${data.doomscroll_minutes}min` },
        { label: 'Ingen porno', value: data.no_porn ? '✓' : '✗' },
      ],
    },
    {
      icon: '🦷', title: 'Hygiejne',
      fields: [
        { label: 'Tænder', value: `${data.brushed_teeth}x` },
        { label: 'Tandtråd', value: data.flossed ? '✓' : '✗' },
        { label: 'Koldt bad', value: data.cold_shower ? '✓' : '✗' },
      ],
    },
  ]

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.02)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {sections.map(sec => (
          <div key={sec.title}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              {sec.icon} {sec.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {sec.fields.map(f => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--muted)' }}>{f.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CompareOverlay ───────────────────────────────────────────────────────────

function CompareOverlay({ mySpider, compareSpider, compareName, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 190,
        }}
      />
      {/* Sheet */}
      <div
        className="animate-up"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '480px',
          background: 'var(--card)',
          borderRadius: '24px 24px 0 0',
          padding: '24px 20px 36px',
          zIndex: 200,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>
            Dig vs {compareName}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              background: 'var(--g50)',
              border: '1.5px solid var(--border)',
              fontSize: '16px',
              color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SpiderChart
            data={mySpider}
            dataB={compareSpider}
            size={280}
            colorB="#e76f51"
            nameB={compareName}
          />
        </div>
      </div>
    </>
  )
}

// ─── Hjælpe-komponenter ───────────────────────────────────────────────────────

function CheckDots({ total, filled }) {
  const displayTotal = Math.min(total, 30) // cap ved 30 for visuel klarhed
  return (
    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: '80px' }}>
      {Array.from({ length: displayTotal }).map((_, i) => (
        <div
          key={i}
          style={{
            width: total > 7 ? '5px' : '7px',
            height: total > 7 ? '5px' : '7px',
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
