import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, authFunctions, profileFunctions } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const loadProfile = useCallback(async (userId) => {
    try {
      const data = await profileFunctions.getProfile(userId)
      setProfile(data)
      return data
    } catch (err) {
      console.error('Profile load error:', err)
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    // Boshlang'ich sessiyani tekshir
    authFunctions.getSession().then(async (session) => {
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
      setLoading(false)
    })

    // Auth holat o'zgarishlarini kuzat
    // DIQQAT: bu funksiya ichida Supabase'ga so'rov yuborib uni KUTMANG (await) —
    // kirish jarayoni bilan bir-birini kutib qolib, "Kirish" tugmasi abadiy osilib qoladi.
    // Shuning uchun profilni setTimeout orqali kirish tugagandan keyin yuklaymiz.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          const userId = session.user.id
          setTimeout(() => {
            loadProfile(userId).finally(() => setLoading(false))
          }, 0)
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signIn = async (email, password) => {
    setError(null)
    setLoading(true)
    try {
      const data = await authFunctions.signIn(email, password)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await authFunctions.signOut()
      setUser(null)
      setProfile(null)
    } catch (err) {
      console.error('SignOut error:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = () => {
    if (user) loadProfile(user.id)
  }

  const isAdmin    = profile?.role === 'admin'
  const isEmployee = profile?.role === 'employee'

  return (
    <AuthContext.Provider value={{
      user, profile, loading, error,
      isAdmin, isEmployee,
      signIn, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
