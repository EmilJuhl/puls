import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import LeaderboardPage from './pages/LeaderboardPage'
import CheckinPage from './pages/CheckinPage'
import ProfilePage from './pages/ProfilePage'
import BottomNav from './components/BottomNav'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = indlæser
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('leaderboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data)
  }

  // Indlæser
  if (session === undefined) {
    return (
      <div className="splash">
        <span className="splash-emoji">🌱</span>
      </div>
    )
  }

  // Ikke logget ind
  if (!session) return <LoginPage />

  // Logget ind men profil er ikke sat op (standard-navn)
  if (!profile || profile.display_name === 'Spiller') {
    return (
      <ProfilePage
        session={session}
        profile={profile}
        onSave={setProfile}
        isSetup
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="page-content">
        {page === 'leaderboard' && <LeaderboardPage session={session} />}
        {page === 'checkin'     && <CheckinPage session={session} />}
        {page === 'profile'     && (
          <ProfilePage session={session} profile={profile} onSave={setProfile} />
        )}
      </div>
      <BottomNav active={page} onChange={setPage} />
    </div>
  )
}
