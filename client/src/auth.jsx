import { createContext, useContext, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { readAuth, writeAuth, resetSocket } from './api.js'
import { unsubscribePush } from './lib/push.js'
import { roleHome } from './lib/format.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth)

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
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />
  return children
}
