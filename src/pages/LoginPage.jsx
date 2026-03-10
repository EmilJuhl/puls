import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError(null)
    setInfo(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      setLoading(false)
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      setLoading(false)
      if (error) {
        setError(error.message)
      } else {
        setInfo('Konto oprettet! Du er nu logget ind.')
      }
    }
  }

  return (
    <div style={s.page}>
      <div style={s.bg} />

      <div style={s.card} className="animate-up">
        <div style={s.logo}>🌱</div>
        <h1 style={s.title}>Peak</h1>
        <p style={s.tagline}>Konkurrér om at leve sundest</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email"
            placeholder="din@email.dk"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={s.input}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Kodeord"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={s.input}
            required
            minLength={6}
          />

          {error && <p style={s.error}>{error}</p>}
          {info  && <p style={s.success}>{info}</p>}

          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Vent...' : mode === 'login' ? 'Log ind' : 'Opret konto'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null) }}
          style={s.toggle}
        >
          {mode === 'login' ? 'Har du ikke en konto? Opret her' : 'Har du allerede en konto? Log ind'}
        </button>
      </div>

      <p style={s.footer}>Peak · {new Date().getFullYear()}</p>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 20%, rgba(82,183,136,0.12) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(45,106,79,0.10) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
  },
  card: {
    background: 'var(--card)',
    borderRadius: '24px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow-md)',
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  logo: {
    fontSize: '52px',
    lineHeight: 1,
    marginBottom: '16px',
    filter: 'drop-shadow(0 4px 12px rgba(45,106,79,0.2))',
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: '36px',
    fontWeight: 900,
    color: 'var(--g900)',
    letterSpacing: '-0.02em',
    marginBottom: '8px',
  },
  tagline: {
    fontSize: '15px',
    color: 'var(--muted)',
    marginBottom: '32px',
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1.5px solid var(--border)',
    fontSize: '16px',
    background: 'var(--g50)',
    color: 'var(--text)',
    outline: 'none',
  },
  btn: {
    padding: '15px',
    borderRadius: '12px',
    background: 'var(--g700)',
    color: 'white',
    fontSize: '15px',
    fontWeight: 700,
    marginTop: '4px',
  },
  toggle: {
    marginTop: '16px',
    fontSize: '13px',
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  error: {
    fontSize: '13px',
    color: '#c0392b',
    background: '#fdf2f2',
    padding: '10px 12px',
    borderRadius: '8px',
    textAlign: 'left',
  },
  success: {
    fontSize: '13px',
    color: '#2d6a4f',
    background: '#e8f5ec',
    padding: '10px 12px',
    borderRadius: '8px',
    textAlign: 'left',
  },
  footer: {
    marginTop: '24px',
    fontSize: '12px',
    color: 'var(--muted)',
    position: 'relative',
    zIndex: 1,
  },
}
