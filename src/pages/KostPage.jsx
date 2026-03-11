import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import AvatarDisplay from '../components/AvatarDisplay'

// Supabase project URL (til Edge Function kald)
const SUPABASE_URL = 'https://yskvxkhefpltgmyajqmt.supabase.co'

// --- Komprimér billede til ~800px via Canvas ---
function compressImage(file, maxPx = 800) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}

// --- Blob → base64 ---
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.readAsDataURL(blob)
  })
}

// --- Point-breakdown for ét måltid ---
function MealBreakdown({ meal }) {
  const rows = [
    meal.has_vegetables     && { label: 'Grøntsager',         pts: '+2p', pos: true },
    meal.has_protein_source && { label: 'Protein',            pts: '+2p', pos: true },
    meal.has_fruit          && { label: 'Frugt',              pts: '+1p', pos: true },
    meal.is_homemade        && { label: 'Hjemmelavet',        pts: '+2p', pos: true },
    !meal.is_ultra_processed && { label: 'Ikke ultraforarbejdet', pts: '+2p', pos: true },
    meal.is_ultra_processed  && { label: 'Ultraforarbejdet',  pts: '-3p', pos: false },
    meal.meal_quality === 'good' && { label: 'God kvalitet',  pts: '+3p', pos: true },
    meal.meal_quality === 'bad'  && { label: 'Dårlig kvalitet', pts: '-2p', pos: false },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '13px',
        }}>
          <span style={{ color: 'var(--muted)' }}>
            {r.pos ? '✅' : '❌'} {r.label}
          </span>
          <span style={{
            fontWeight: 700,
            color: r.pos ? 'var(--g700)' : '#e53e3e',
          }}>{r.pts}</span>
        </div>
      ))}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '6px',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>Total</span>
        <span style={{
          fontWeight: 800, fontSize: '14px',
          color: meal.meal_score >= 0 ? 'var(--g700)' : '#e53e3e',
        }}>
          {meal.meal_score >= 0 ? '+' : ''}{meal.meal_score}p
        </span>
      </div>
    </div>
  )
}

// --- Ét måltid i feed ---
function MealCard({ meal, showBreakdown = false }) {
  const [open, setOpen] = useState(showBreakdown)
  const timeStr = new Date(meal.created_at).toLocaleTimeString('da-DK', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      overflow: 'hidden', border: '1px solid var(--border)',
    }}>
      {/* Billede */}
      <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
        <img
          src={meal.image_url}
          alt={meal.meal_name ?? 'Måltid'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Score badge */}
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          background: meal.meal_score >= 0 ? 'var(--g700)' : '#e53e3e',
          color: 'white', borderRadius: '20px', padding: '4px 10px',
          fontSize: '13px', fontWeight: 800,
        }}>
          {meal.meal_score >= 0 ? '+' : ''}{meal.meal_score}p
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              {meal.meal_name ?? 'Ukendt måltid'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {timeStr}
              {meal.ai_confidence && (
                <span style={{ marginLeft: '6px' }}>
                  · {meal.ai_confidence === 'high' ? '🎯 Sikker' : meal.ai_confidence === 'medium' ? '🤔 Usikker' : '❓ Gæt'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              fontSize: '18px', background: 'none', border: 'none',
              color: 'var(--muted)', transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
            }}
          >
            ›
          </button>
        </div>

        {open && <MealBreakdown meal={meal} />}
      </div>
    </div>
  )
}

// --- Social feed kort ---
function SocialMealCard({ meal }) {
  const timeStr = new Date(meal.created_at).toLocaleTimeString('da-DK', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      overflow: 'hidden', border: '1px solid var(--border)',
    }}>
      {/* Billede */}
      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden' }}>
        <img
          src={meal.image_url}
          alt={meal.meal_name ?? 'Måltid'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{
          position: 'absolute', top: '8px', right: '8px',
          background: meal.meal_score >= 0 ? 'var(--g700)' : '#e53e3e',
          color: 'white', borderRadius: '20px', padding: '3px 8px',
          fontSize: '12px', fontWeight: 800,
        }}>
          {meal.meal_score >= 0 ? '+' : ''}{meal.meal_score}p
        </div>
      </div>
      {/* Brugerinfo */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AvatarDisplay
          avatarConfig={meal.profiles?.avatar_config}
          emojiAvatar={meal.profiles?.emoji_avatar ?? '🔥'}
          size={36}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meal.profiles?.display_name ?? 'Spiller'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {meal.meal_name ?? 'Måltid'} · {timeStr}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Loading animation ---
function AnalyzingLoader() {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      border: '1px solid var(--border)', padding: '32px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        border: '4px solid var(--g100)', borderTopColor: 'var(--g700)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ fontWeight: 700, color: 'var(--g700)' }}>AI analyserer dit måltid...</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Claude Vision er i gang 🤖</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function KostPage({ session }) {
  const [myMeals, setMyMeals]         = useState([])
  const [socialFeed, setSocialFeed]   = useState([])
  const [kostScore, setKostScore]     = useState(0)
  const [mealCount, setMealCount]     = useState(0)
  const [bonuses, setBonuses]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [analyzing, setAnalyzing]     = useState(false)
  const [lastResult, setLastResult]   = useState(null) // seneste analyserede måltid
  const [error, setError]             = useState(null)
  const fileInputRef = useRef(null)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadAll()

    // Realtime: lyt til nye måltider
    const channel = supabase
      .channel('meals-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meals' }, () => {
        loadSocialFeed()
        if (session?.user?.id) loadMyMeals()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadMyMeals(), loadSocialFeed(), loadKostScore()])
    setLoading(false)
  }

  async function loadMyMeals() {
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', today)
      .order('created_at', { ascending: false })
    setMyMeals(data ?? [])
    setMealCount(data?.length ?? 0)
  }

  async function loadSocialFeed() {
    const { data } = await supabase
      .from('meals')
      .select('*, profiles(display_name, emoji_avatar, avatar_config)')
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(50)
    setSocialFeed(data ?? [])
  }

  async function loadKostScore() {
    const { data } = await supabase
      .from('daily_scores')
      .select('kost_score')
      .eq('user_id', session.user.id)
      .eq('date', today)
      .maybeSingle()
    setKostScore(data?.kost_score ?? 0)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset så samme fil kan uploades igen

    setAnalyzing(true)
    setError(null)
    setLastResult(null)

    try {
      // Komprimér
      const compressed = await compressImage(file)
      const base64 = await blobToBase64(compressed)

      // Hent session token
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const token = currentSession?.access_token
      if (!token) throw new Error('Ikke logget ind')

      // Kald Edge Function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-meal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ image_base64: base64, date: today }),
      })

      let json
      const rawText = await res.text()
      try { json = JSON.parse(rawText) } catch { throw new Error('Serverfejl: ' + rawText.slice(0, 200)) }
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      setLastResult(json)
      setKostScore(json.kost_score ?? 0)
      setBonuses(json.bonuses)
      setMealCount(json.meal_count ?? 0)

      // Reload feeds
      await Promise.all([loadMyMeals(), loadSocialFeed()])
    } catch (err) {
      setError(err.message ?? 'Noget gik galt')
    } finally {
      setAnalyzing(false)
    }
  }

  const todayBonusThreeMeals = bonuses?.three_meals ?? (mealCount >= 3)
  const todayBonusNoUPF      = bonuses?.no_upf ?? (myMeals.length > 0 && !myMeals.some(m => m.is_ultra_processed))

  return (
    <div style={{ paddingBottom: '90px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--g700) 0%, var(--g500) 100%)',
        padding: '24px 20px 20px',
        color: 'white',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.85, marginBottom: '4px' }}>
          Dagens kost-score
        </div>
        <div style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, fontFamily: 'Fraunces, serif' }}>
          {kostScore >= 0 ? '+' : ''}{kostScore}p
        </div>
        <div style={{ fontSize: '13px', opacity: 0.75, marginTop: '6px' }}>
          {mealCount} måltid{mealCount !== 1 ? 'er' : ''} logget i dag
        </div>

        {/* Daglige bonusser */}
        {mealCount > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <div style={{
              background: todayBonusThreeMeals ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
              border: `1px solid ${todayBonusThreeMeals ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
            }}>
              {todayBonusThreeMeals ? '✅' : '⏳'} 3+ måltider +5p
            </div>
            <div style={{
              background: todayBonusNoUPF ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
              border: `1px solid ${todayBonusNoUPF ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
            }}>
              {todayBonusNoUPF ? '✅' : '⏳'} 0 UPF bonus +5p
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* + Knap */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          onClick={() => !analyzing && fileInputRef.current?.click()}
          disabled={analyzing}
          style={{
            background: analyzing ? 'var(--g300)' : 'var(--g700)',
            color: 'white', borderRadius: 'var(--radius)', padding: '16px',
            fontSize: '17px', fontWeight: 800, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: analyzing ? 'none' : '0 4px 16px rgba(45,106,79,0.35)',
            transition: 'all 0.2s',
            opacity: analyzing ? 0.7 : 1,
          }}
        >
          <span style={{ fontSize: '24px' }}>📸</span>
          {analyzing ? 'Analyserer...' : 'Foto dit mad'}
        </button>

        {/* Fejlbesked */}
        {error && (
          <div style={{
            background: '#fff5f5', border: '1px solid #fed7d7',
            borderRadius: 'var(--radius-sm)', padding: '12px 16px',
            color: '#c53030', fontSize: '14px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading animation */}
        {analyzing && <AnalyzingLoader />}

        {/* Seneste resultat (nyeste måltid fra feed) */}
        {!analyzing && lastResult?.meal && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px', color: 'var(--g700)' }}>
              🎉 Analyseret!
            </div>
            <MealCard meal={lastResult.meal} showBreakdown />
          </div>
        )}

        {/* Egne måltider i dag */}
        {!loading && myMeals.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '10px' }}>
              Mine måltider i dag
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myMeals.map(meal => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          </div>
        )}

        {/* Ingen måltider endnu */}
        {!loading && !analyzing && myMeals.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 20px', color: 'var(--muted)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🍽️</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Ingen måltider endnu</div>
            <div style={{ fontSize: '13px' }}>Tag et billede af dit næste måltid</div>
          </div>
        )}

        {/* Social feed */}
        {socialFeed.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '10px' }}>
              Alle spilleres mad i dag
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
            }}>
              {socialFeed.map(meal => (
                <SocialMealCard key={meal.id} meal={meal} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
