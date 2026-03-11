const TABS = [
  { key: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
  { key: 'checkin',     icon: '✅', label: 'Tjek ind'    },
  { key: 'kost',        icon: '🍽️', label: 'Kost'        },
  { key: 'profile',     icon: '👤', label: 'Profil'      },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      height: '72px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'opacity 0.15s',
            }}
          >
            {/* Aktiv indikator */}
            {isActive && (
              <div style={{
                position: 'absolute',
                top: '6px',
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'var(--g100)',
              }} />
            )}

            <span style={{
              fontSize: '20px',
              position: 'relative',
              zIndex: 1,
              filter: isActive ? 'none' : 'grayscale(0.4) opacity(0.6)',
              transition: 'filter 0.15s',
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--g700)' : 'var(--muted)',
              position: 'relative',
              zIndex: 1,
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
