import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'queueless.theme'
const Ctx = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} })

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' } })
  const [sys, setSys] = useState(systemDark)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSys(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const resolved = theme === 'system' ? (sys ? 'dark' : 'light') : theme
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', theme)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', resolved === 'dark' ? '#0a0e17' : '#f7f8fb')
    try { localStorage.setItem(KEY, theme) } catch {}
  }, [theme, resolved])
  const value = useMemo(() => ({ theme, resolved, setTheme, toggle: () => setTheme(resolved === 'dark' ? 'light' : 'dark') }), [theme, resolved])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
