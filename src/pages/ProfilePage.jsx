import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EMOJIS = ['🌱', '🔥', '💪', '🏃', '🧘', '🥗', '🏋️', '🚴', '🌊', '❄️', '🌿', '⚡']

export default function ProfilePage({ session, profile, onSave, isSetup = false }) {
  const [name, setName] = useState(
    profile?.display_name && profile.display_name !== 'Spiller' ? profile.display_name : ''
  )
  const [avatar, setAvatar] = useState(profile?.emoji_avatar || '🌱')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setSaved(false)

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, display_name: name.trim(), emoji_avatar: avatar })
      .select()
      .single()

    setSaving(false)
    if (!error && data) {
      onSave(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {isSetup ? 'Opsæt profil' : 'Profil'}
        </h1>
        {isSetup && (
          <p className="page-subtitle">Vælg navn og avatar for at komme i gang</p>
        )}
      </div>

      <form onSubmit={handleSave} style={{ padding: '0 20px' }}>

        {/* Avatar preview */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'var(--g100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            boxShadow: '0 4px 20px rgba(45,106,79,0.15)',
          }}>
            {avatar}
          </div>
        </div>

        {/* Emoji picker */}
        <div style={{ marginBottom: '20px' }}>
          <div style={s.label}>Vælg avatar</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
          }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setAvatar(e)}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  fontSize: '24px',
                  background: avatar === e ? 'var(--g100)' : 'var(--card)',
                  border: `2px solid ${avatar === e ? 'var(--g500)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Navn */}
        <div style={{ marginBottom: '24px' }}>
          <div style={s.label}>Dit navn</div>
          <input
            type="text"
            placeholder="Hvad hedder du?"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            style={s.input}
            required
          />
        </div>

        {/* Email (read-only info) */}
        <div style={{ marginBottom: '24px' }}>
          <div style={s.label}>Email</div>
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--g50)',
            border: '1.5px solid var(--border)',
            fontSize: '14px',
            color: 'var(--muted)',
          }}>
            {session.user.email}
          </div>
        </div>

        {/* Gem */}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '14px',
            background: saved ? 'var(--g500)' : 'var(--g700)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            marginBottom: '12px',
            transition: 'background 0.2s',
            opacity: !name.trim() ? 0.6 : 1,
          }}
        >
          {saving ? '⏳ Gemmer...' : saved ? '✓ Gemt!' : isSetup ? 'Kom i gang →' : 'Gem ændringer'}
        </button>

        {/* Log ud */}
        {!isSetup && (
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'transparent',
              border: '1.5px solid var(--border)',
              color: 'var(--muted)',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Log ud
          </button>
        )}
      </form>
    </div>
  )
}

const s = {
  label: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1.5px solid var(--border)',
    background: 'var(--g50)',
    fontSize: '16px',
    color: 'var(--text)',
    outline: 'none',
  },
}
