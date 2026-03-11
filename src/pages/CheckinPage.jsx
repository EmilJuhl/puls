import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function getDateStr(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

const DEFAULTS = {
  // Søvn
  sleep_hours: 9.5,
  sleep_consistent: false,
  // Fysik
  steps: 0,
  strength_minutes: 0,
  cardio_minutes: 0,
  // Disciplin
  homework_done: false,
  on_time: false,
  skipped_class: false,
  earned_money: false,
  saved_money: false,
  reading_minutes: 0,
  // Skærm
  passive_screen_hours: 3,
  doomscroll_minutes: 0,
  no_porn: false,
  // Hygiejne
  brushed_teeth: 0,
  flossed: false,
  cold_shower: false,
}

// Max point per kategori — bruges til score card progress bars
const CAT_MAX = {
  sleep_score:     15,
  fysik_score:     30,
  disciplin_score: 35,
  screen_score:    15,
  hygiejne_score:  9,
}

export default function CheckinPage({ session }) {
  const [tab, setTab] = useState('idag')
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [score, setScore] = useState(null)
  const [hasExisting, setHasExisting] = useState(false)

  const activeDate = getDateStr(tab === 'igaar' ? 1 : 0)

  useEffect(() => {
    setForm(DEFAULTS)
    setScore(null)
    setHasExisting(false)
    setLoading(true)
    loadCheckin(activeDate)
  }, [tab])

  async function loadCheckin(date) {
    const { data } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .maybeSingle()

    if (data) {
      setHasExisting(true)
      const merged = { ...DEFAULTS }
      Object.keys(DEFAULTS).forEach(k => {
        if (data[k] !== null && data[k] !== undefined) merged[k] = data[k]
      })
      setForm(merged)

      const { data: s } = await supabase
        .from('daily_scores')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .maybeSingle()
      if (s) setScore(s)
    }
    setLoading(false)
  }

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setScore(null)

    const { error } = await supabase
      .from('daily_checkins')
      .upsert({
        user_id: session.user.id,
        date: activeDate,
        ...form,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })

    if (!error) {
      await new Promise(r => setTimeout(r, 600))
      const { data: s } = await supabase
        .from('daily_scores')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', activeDate)
        .maybeSingle()
      if (s) {
        setScore(s)
        setHasExisting(true)
      }
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)' }}>
        <span className="splash-emoji">🔥</span>
      </div>
    )
  }

  const dateObj = new Date(activeDate + 'T12:00:00')
  const dateLabel = dateObj.toLocaleDateString('da-DK', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Check-in</h1>
        {/* Tab-bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          background: 'var(--g50)',
          borderRadius: '12px',
          padding: '4px',
        }}>
          {[
            { id: 'idag', label: 'I dag' },
            { id: 'igaar', label: 'I går' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '9px',
                fontSize: '14px',
                fontWeight: 700,
                background: tab === t.id ? 'var(--g700)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="page-subtitle" style={{ textTransform: 'capitalize', marginTop: '8px' }}>
          {dateLabel}
        </p>
        {tab === 'igaar' && (
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Du redigerer gårsdagens check-in
          </p>
        )}
      </div>

      {score && <ScoreCard score={score} />}

      <form onSubmit={handleSubmit}>

        {/* SØVN */}
        <Section icon="😴" title="Søvn">
          <SliderField
            label="Timer sovet"
            value={form.sleep_hours}
            onChange={v => set('sleep_hours', v)}
            min={0} max={14} step={0.5}
            unit="t"
          />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-6px' }}>
            9-10t = 10p · 8-9t / 10-11t = 7p · 7-8t / 11-12t = 4p
          </div>
          <ToggleRow
            label="Stod op inden for ±30 min af fast vækketid"
            value={form.sleep_consistent}
            onChange={v => set('sleep_consistent', v)}
          />
        </Section>

        {/* FYSIK */}
        <Section icon="🏋️" title="Fysik">
          <div style={s.fieldLabel}>Skridt</div>
          <StepInput
            value={form.steps}
            onChange={v => set('steps', v)}
          />
          <StepperRow
            label="Styrketræning"
            value={form.strength_minutes}
            onChange={v => set('strength_minutes', v)}
            step={5} unit="min"
          />
          <StepperRow
            label="Cardio"
            value={form.cardio_minutes}
            onChange={v => set('cardio_minutes', v)}
            step={5} unit="min"
          />
        </Section>

        {/* DISCIPLIN */}
        <Section icon="📚" title="Disciplin">
          <ToggleRow
            label="Lavet lektier"
            value={form.homework_done}
            onChange={v => set('homework_done', v)}
          />
          <ToggleRow
            label="Mødt til tiden"
            value={form.on_time}
            onChange={v => set('on_time', v)}
          />
          <StepperRow
            label="Læst"
            value={form.reading_minutes}
            onChange={v => set('reading_minutes', v)}
            step={5} unit="min"
          />
          <ToggleRow
            label="Tjente penge i dag"
            value={form.earned_money}
            onChange={v => {
              set('earned_money', v)
              if (!v) set('saved_money', false)
            }}
          />
          {form.earned_money && (
            <ToggleRow
              label="Satte penge til side (+7p bonus)"
              value={form.saved_money}
              onChange={v => set('saved_money', v)}
            />
          )}
          <ToggleRow
            label="Skippede et modul (-10p)"
            value={form.skipped_class}
            onChange={v => set('skipped_class', v)}
            danger
          />
        </Section>

        {/* SKÆRM */}
        <Section icon="📵" title="Skærm">
          <SliderField
            label="Passivt skærmbrug"
            value={form.passive_screen_hours}
            onChange={v => set('passive_screen_hours', v)}
            min={0} max={16} step={0.5}
            unit="t"
          />
          <StepperRow
            label="Doomscrolling"
            value={form.doomscroll_minutes}
            onChange={v => set('doomscroll_minutes', v)}
            step={5} unit="min"
          />
          <ToggleRow
            label="Ingen porno"
            value={form.no_porn}
            onChange={v => set('no_porn', v)}
          />
        </Section>

        {/* HYGIEJNE */}
        <Section icon="🦷" title="Hygiejne">
          <div>
            <div style={{ ...s.fieldLabel, marginBottom: '10px' }}>Børstede tænder</div>
            <BrushedTeethSelector
              value={form.brushed_teeth}
              onChange={v => set('brushed_teeth', v)}
            />
          </div>
          <ToggleRow
            label="Brugte tandtråd"
            value={form.flossed}
            onChange={v => set('flossed', v)}
          />
          <ToggleRow
            label="Koldt bad"
            value={form.cold_shower}
            onChange={v => set('cold_shower', v)}
          />
        </Section>

        {/* Submit */}
        <div style={{ padding: '0 20px 32px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              background: saving ? 'var(--g300)' : 'var(--g700)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 700,
              transition: 'background 0.2s',
              boxShadow: '0 4px 16px rgba(45,106,79,0.3)',
            }}
          >
            {saving ? '⏳ Gemmer...' : hasExisting ? '↻ Opdatér check-in' : '✓ Registrér dag'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Score card ──────────────────────────────────────────────────────────────

function ScoreCard({ score }) {
  const total = score.total_score

  const cats = [
    { key: 'sleep_score',     label: 'Søvn',      max: CAT_MAX.sleep_score,     icon: '😴' },
    { key: 'fysik_score',     label: 'Fysik',     max: CAT_MAX.fysik_score,     icon: '🏋️' },
    { key: 'disciplin_score', label: 'Disciplin', max: CAT_MAX.disciplin_score, icon: '📚' },
    { key: 'screen_score',    label: 'Skærm',     max: CAT_MAX.screen_score,    icon: '📵' },
    { key: 'hygiejne_score',  label: 'Hygiejne',  max: CAT_MAX.hygiejne_score,  icon: '🦷' },
  ]

  return (
    <div className="animate-up" style={{
      margin: '0 20px 16px',
      background: 'var(--g700)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      color: 'white',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7, marginBottom: '2px' }}>DAGENS SCORE</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '48px', fontWeight: 900, lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>/ 94 mulige point</div>
        </div>
        <div style={{ fontSize: '36px' }}>
          {total >= 85 ? '🔥' : total >= 60 ? '💪' : total >= 35 ? '👍' : '🌱'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cats.map(cat => {
          const val = score[cat.key] ?? 0
          const pct = Math.max(0, Math.round((val / cat.max) * 100))
          const isNegative = val < 0
          return (
            <div key={cat.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', opacity: 0.85, fontWeight: 500 }}>
                  {cat.icon} {cat.label}
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: isNegative ? '#ff8a80' : 'white',
                }}>
                  {isNegative ? val : `${val}`}
                </span>
              </div>
              <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: '2px',
                  background: isNegative ? '#ff8a80' : 'rgba(255,255,255,0.85)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sub-komponenter ──────────────────────────────────────────────────────────

function Section({ icon, title, children }) {
  return (
    <div style={{ padding: '0 20px', marginBottom: '16px' }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{title}</span>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function SliderField({ label, value, onChange, min, max, step, unit }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={s.fieldLabel}>{label}</span>
        <span style={s.fieldValue}>{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={s.rangeLabel}>{min}{unit}</span>
        <span style={s.rangeLabel}>{max}{unit}</span>
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange, danger = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{
        fontSize: '14px',
        color: danger ? 'var(--danger, #e53935)' : 'var(--text)',
        lineHeight: 1.4,
        flex: 1,
      }}>
        {label}
      </span>
      <Toggle value={value} onChange={onChange} danger={danger} />
    </div>
  )
}

function Toggle({ value, onChange, danger = false }) {
  const activeColor = danger ? '#e53935' : 'var(--g700)'
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: '50px',
        height: '28px',
        borderRadius: '14px',
        background: value ? activeColor : 'var(--g100)',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: value ? '25px' : '3px',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }} />
    </button>
  )
}

function BrushedTeethSelector({ value, onChange }) {
  const options = [
    { val: 0, label: 'Ingen' },
    { val: 1, label: '1 gang' },
    { val: 2, label: '2 gange' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
      {options.map(o => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          style={{
            padding: '10px 4px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            background: value === o.val ? 'var(--g700)' : 'var(--g50)',
            color: value === o.val ? 'white' : 'var(--muted)',
            border: value === o.val ? 'none' : '1px solid var(--border)',
            transition: 'all 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StepperRow({ label, value, onChange, step = 1, unit = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontSize: '14px', color: 'var(--text)', flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <StepBtn
          sign="−"
          onClick={() => onChange(Math.max(0, parseFloat((value - step).toFixed(1))))}
        />
        <span style={{ minWidth: '44px', textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>
          {value}{unit && <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginLeft: '2px' }}>{unit}</span>}
        </span>
        <StepBtn
          sign="+"
          active
          onClick={() => onChange(parseFloat((value + step).toFixed(1)))}
        />
      </div>
    </div>
  )
}

function StepBtn({ sign, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: active ? 'var(--g700)' : 'var(--g50)',
        border: active ? 'none' : '1.5px solid var(--border)',
        fontSize: '18px',
        color: active ? 'white' : 'var(--g700)',
        fontWeight: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {sign}
    </button>
  )
}

function StepInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
      <StepBtn sign="−" onClick={() => onChange(Math.max(0, value - 1000))} />
      <input
        type="number"
        value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{
          flex: 1,
          padding: '10px',
          borderRadius: '10px',
          border: '1.5px solid var(--border)',
          background: 'var(--g50)',
          fontSize: '18px',
          fontWeight: 700,
          textAlign: 'center',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
      <StepBtn sign="+" active onClick={() => onChange(value + 1000)} />
    </div>
  )
}

const s = {
  fieldLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--muted)',
  },
  fieldValue: {
    fontFamily: "'Fraunces', serif",
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--g700)',
  },
  rangeLabel: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
}
