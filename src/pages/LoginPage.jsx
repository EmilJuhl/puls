import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div style={s.page}>
      {/* Baggrundsmønster */}
      <div style={s.bg} />

      <div style={s.card} className="animate-up">
        <div style={s.logo}>🌱</div>
        <h1 style={s.title}>Peak</h1>
        <p style={s.tagline}>Konkurrér om at leve sundest</p>

        {sent ? (
          <div style={s.success}>
            <div style={s.successIcon}>✉️</div>
            <p style={s.successTitle}>Tjek din email</p>
            <p style={s.successText}>
              Vi har sendt et login-link til <strong>{email}</strong>.
              Klik på linket for at logge ind.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.inputWrap}>
              <input
                type="email"
                placeholder="din@email.dk"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={s.input}
                required
                autoFocus
              />
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? (
                <span style={s.btnInner}>
                  <span style={s.spinner} />
                  Sender...
                </span>
              ) : (
                'Send magic link'
              )}
            </button>
            <p style={s.hint}>Ingen kodeord — bare klik på linket i din email</p>
          </form>
        )}
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
  inputWrap: {
    position: 'relative',
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
    transition: 'border-color 0.2s',
  },
  btn: {
    padding: '15px',
    borderRadius: '12px',
    background: 'var(--g700)',
    color: 'white',
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '0.01em',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    animation: 'spin 0.7s linear infinite',
  },
  hint: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '4px',
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
    textAlign: 'center',
    padding: '8px 0',
  },
  successIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  successTitle: {
    fontFamily: "'Fraunces', serif",
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '8px',
    color: 'var(--g900)',
  },
  successText: {
    fontSize: '14px',
    color: 'var(--muted)',
    lineHeight: 1.6,
  },
  footer: {
    marginTop: '24px',
    fontSize: '12px',
    color: 'var(--muted)',
    position: 'relative',
    zIndex: 1,
  },
}
