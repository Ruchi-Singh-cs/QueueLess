import { createContext, useContext, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { readAuth, writeAuth, resetSocket } from './api.js'
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
