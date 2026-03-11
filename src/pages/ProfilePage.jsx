import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import AvatarDisplay from '../components/AvatarDisplay'
import AvatarEditor from '../components/AvatarEditor'

export default function ProfilePage({ session, profile, onSave, isSetup = false }) {
  const [name, setName] = useState(
    profile?.display_name && profile.display_name !== 'Spiller' ? profile.display_name : ''
  )
  const [avatarConfig, setAvatarConfig] = useState(profile?.avatar_config || null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [achievements, setAchievements] = useState([])
  const [achievementsLoading, setAchievementsLoading] = useState(true)

  useEffect(() => {
    if (!isSetup) loadAchievements()
  }, [])

  async function loadAchievements() {
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at, achievements(name, icon, description, is_positive, category)')
      .eq('user_id', session.user.id)
      .order('earned_at', { ascending: false })
    if (data) setAchievements(data)
    setAchievementsLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setSaved(false)

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        display_name: name.trim(),
        emoji_avatar: profile?.emoji_avatar || '🔥',
        avatar_config: avatarConfig,
      })
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

  const positiveAchievements = achievements.filter(a => a.achievements?.is_positive)
  const negativeAchievements = achievements.filter(a => !a.achievements?.is_positive)

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

        {/* Avatar preview + rediger */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '24px',
            background: 'var(--card)',
            boxShadow: '0 4px 24px rgba(45,106,79,0.15)',
            marginBottom: '12px',
          }}>
            <AvatarDisplay
              avatarConfig={avatarConfig}
              emojiAvatar={profile?.emoji_avatar || '🔥'}
              size={88}
            />
          </div>
          <button
            type="button"
            onClick={() => setEditingAvatar(e => !e)}
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--g700)',
              background: 'var(--g50)',
              border: '1.5px solid var(--g300)',
              borderRadius: '10px',
              padding: '6px 14px',
            }}
          >
            {editingAvatar ? '▲ Skjul avatar-editor' : '✏️ Rediger avatar'}
          </button>
        </div>

        {/* Avatar editor */}
        {editingAvatar && (
          <div className="animate-up" style={{
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: '20px 16px',
            marginBottom: '20px',
          }}>
            <AvatarEditor value={avatarConfig} onChange={setAvatarConfig} />
          </div>
        )}

        {/* Navn */}
        <div style={{ marginBottom: '20px' }}>
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

        {/* Email (read-only) */}
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

      {/* Achievements */}
      {!isSetup && (
        <div style={{ padding: '24px 20px 80px' }}>
          <div style={s.label}>Achievements</div>

          {achievementsLoading ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              Henter achievements…
            </div>
          ) : achievements.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 20px',
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              color: 'var(--muted)',
              fontSize: '13px',
              boxShadow: 'var(--shadow)',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
              <p style={{ fontWeight: 600 }}>Ingen achievements endnu</p>
              <p style={{ marginTop: '4px' }}>Hold dig aktiv for at låse dem op!</p>
            </div>
          ) : (
            <>
              {positiveAchievements.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--g700)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Positive
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {positiveAchievements.map(ua => (
                      <AchievementCard key={ua.achievement_id} ua={ua} />
                    ))}
                  </div>
                </div>
              )}

              {negativeAchievements.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#c62828', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Skam-achievements
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {negativeAchievements.map(ua => (
                      <AchievementCard key={ua.achievement_id} ua={ua} negative />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AchievementCard({ ua, negative = false }) {
  const [showDesc, setShowDesc] = useState(false)
  const a = ua.achievements
  if (!a) return null

  const earnedDate = new Date(ua.earned_at).toLocaleDateString('da-DK', {
    day: 'numeric', month: 'short'
  })

  return (
    <div
      onClick={() => setShowDesc(d => !d)}
      style={{
        background: negative ? '#fff5f5' : 'var(--card)',
        borderRadius: '12px',
        border: `1.5px solid ${negative ? '#ef9a9a' : 'var(--border)'}`,
        padding: '12px 8px',
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow)',
        transition: 'transform 0.1s',
      }}
    >
      <div style={{ fontSize: '28px', marginBottom: '6px' }}>{a.icon}</div>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: negative ? '#c62828' : 'var(--text)',
        lineHeight: 1.3,
        marginBottom: '4px',
      }}>
        {a.name}
      </div>
      {showDesc ? (
        <div style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: 1.3 }}>
          {a.description}
        </div>
      ) : (
        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
          {earnedDate}
        </div>
      )}
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
