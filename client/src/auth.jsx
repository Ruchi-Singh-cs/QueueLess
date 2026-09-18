import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, readAuth, writeAuth, resetSocket } from './api.js'
import { unsubscribePush } from './lib/push.js'
import { roleHome } from './lib/format.js'
import { useToast } from './ui/Toast.jsx'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth)
  // the stored user is a snapshot from login: pick up a role an admin changed since (and drop an expired token — api() redirects on 401)
  useEffect(() => {
    if (auth.token) api('/api/auth/me').then(({ user }) => setAuth((a) => { const next = { ...a, user }; writeAuth(next); return next })).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function login(data) {
    writeAuth(data)
    resetSocket()
    setAuth({ token: data.token, user: data.user })
  }

  function logout() {
    // hand it the token before we drop it — the server only lets a device's own owner unsubscribe it.
    // Deliberately not awaited: logging out must feel instant, and callers navigate away right after.
    unsubscribePush(auth.token).catch(() => {})
    writeAuth(null)
    resetSocket()
    setAuth({ token: null, user: null })
  }

  function updateUser(user) {
    const next = { ...auth, user }
    writeAuth(next)
    setAuth(next)
  }

  return <AuthContext.Provider value={{ ...auth, login, logout, updateUser }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/** Gate a route: unauthenticated → /login (remembering where they were); wrong role → their own home. */
export function RequireAuth({ roles, children }) {
  const { user } = useAuth()
  const location = useLocation()
  const toast = useToast()
  // Bouncing someone to their own home with no explanation reads as a broken page — especially for
  // a vendor URL opened while signed in as a customer, which is the common way to land here.
  const wrongRole = !!user && !!roles && !roles.includes(user.role)
  const warned = useRef(false) // StrictMode runs effects twice in dev; one notice is enough
  useEffect(() => {
    if (wrongRole && !warned.current) {
      warned.current = true
      toast.info('That page needs a business account.', {
        description: `You're signed in as ${user.name} (${user.role}). Sign in with a vendor or admin account to open it.`,
      })
    }
  }, [wrongRole, user?.name, user?.role, toast])

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (wrongRole) return <Navigate to={roleHome(user.role)} replace />
  return children
}
