// AvatarEditor — gaming avatar konfigurations-UI.
//
// Props:
//   value:    avatarConfig objekt (eller null)
//   onChange: callback med opdateret config

import AvatarDisplay from './AvatarDisplay'

const SHAPES = [
  { id: 'circle',  label: 'Cirkel' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'diamond', label: 'Diamant' },
  { id: 'shield',  label: 'Skjold' },
  { id: 'skull',   label: 'Kranium' },
]

const ICONS = [
  { id: 'flame',     label: '🔥' },
  { id: 'sword',     label: '⚔️' },
  { id: 'skull',     label: '💀' },
  { id: 'lightning', label: '⚡' },
  { id: 'crown',     label: '👑' },
  { id: 'snake',     label: '🐍' },
  { id: 'eagle',     label: '🦅' },
  { id: 'eye',       label: '👁️' },
  { id: 'wolf',      label: '🐺' },
]

const BORDER_STYLES = [
  { id: 'solid',  label: 'Solid' },
  { id: 'dashed', label: 'Stribet' },
  { id: 'double', label: 'Dobbelt' },
  { id: 'neon',   label: 'Neon' },
]

const BADGES = [
  { id: null,     label: 'Ingen' },
  { id: 'bronze', label: '🟤 Bronze' },
  { id: 'silver', label: '⚪ Sølv' },
  { id: 'gold',   label: '🟡 Guld' },
]

const DEFAULT_CONFIG = {
  shape: 'circle',
  bgColor1: '#2d6a4f',
  bgColor2: '#52b788',
  icon: 'flame',
  borderColor: '#2d6a4f',
  borderStyle: 'solid',
  badge: null,
}

export default function AvatarEditor({ value, onChange }) {
  const cfg = value || DEFAULT_CONFIG

  function update(key, val) {
    onChange({ ...cfg, [key]: val })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Preview */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
        <AvatarDisplay avatarConfig={cfg} size={100} />
      </div>

      {/* Shape */}
      <EditorSection label="Form">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SHAPES.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => update('shape', s.id)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                background: cfg.shape === s.id ? 'var(--g700)' : 'var(--g50)',
                color: cfg.shape === s.id ? 'white' : 'var(--muted)',
                border: cfg.shape === s.id ? 'none' : '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </EditorSection>

      {/* Baggrundsgradient */}
      <EditorSection label="Baggrund">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <input
              type="color"
              value={cfg.bgColor1}
              onChange={e => update('bgColor1', e.target.value)}
              style={{ width: '44px', height: '36px', borderRadius: '8px', cursor: 'pointer', border: 'none' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Farve 1</span>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <input
              type="color"
              value={cfg.bgColor2}
              onChange={e => update('bgColor2', e.target.value)}
              style={{ width: '44px', height: '36px', borderRadius: '8px', cursor: 'pointer', border: 'none' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Farve 2</span>
          </div>
          {/* Gradient preview */}
          <div style={{
            flex: 1,
            height: '36px',
            borderRadius: '8px',
            background: `linear-gradient(135deg, ${cfg.bgColor1}, ${cfg.bgColor2})`,
            border: '1px solid var(--border)',
          }} />
        </div>
      </EditorSection>

      {/* Ikon */}
      <EditorSection label="Ikon">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {ICONS.map(ic => (
            <button
              key={ic.id}
              type="button"
              onClick={() => update('icon', ic.id)}
              style={{
                padding: '10px 4px',
                borderRadius: '10px',
                fontSize: '20px',
                background: cfg.icon === ic.id ? 'var(--g700)' : 'var(--g50)',
                border: cfg.icon === ic.id ? 'none' : '1px solid var(--border)',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: cfg.icon === ic.id ? '0 2px 8px rgba(45,106,79,0.3)' : 'none',
              }}
              title={ic.id}
            >
              {ic.label}
            </button>
          ))}
        </div>
      </EditorSection>

      {/* Border */}
      <EditorSection label="Kant">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {BORDER_STYLES.map(bs => (
            <button
              key={bs.id}
              type="button"
              onClick={() => update('borderStyle', bs.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                background: cfg.borderStyle === bs.id ? 'var(--g700)' : 'var(--g50)',
                color: cfg.borderStyle === bs.id ? 'white' : 'var(--muted)',
                border: cfg.borderStyle === bs.id ? 'none' : '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              {bs.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Kantfarve</span>
          <input
            type="color"
            value={cfg.borderColor}
            onChange={e => update('borderColor', e.target.value)}
            style={{ width: '44px', height: '30px', borderRadius: '8px', cursor: 'pointer', border: 'none' }}
          />
        </div>
      </EditorSection>

      {/* Badge */}
      <EditorSection label="Badge">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BADGES.map(b => (
            <button
              key={String(b.id)}
              type="button"
              onClick={() => update('badge', b.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                background: cfg.badge === b.id ? 'var(--g700)' : 'var(--g50)',
                color: cfg.badge === b.id ? 'white' : 'var(--muted)',
                border: cfg.badge === b.id ? 'none' : '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </EditorSection>

    </div>
  )
}

function EditorSection({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '10px',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}
