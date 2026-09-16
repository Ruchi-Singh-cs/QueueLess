import { Stethoscope, Scissors, Landmark, Building2, Wrench, Store } from 'lucide-react'

export const CATEGORIES = [
  { value: 'medical', label: 'Medical', icon: Stethoscope, color: '#dc2626' },
  { value: 'salon', label: 'Salon', icon: Scissors, color: '#db2777' },
  { value: 'bank', label: 'Bank', icon: Landmark, color: '#16a34a' },
  { value: 'government', label: 'Government', icon: Building2, color: '#d97706' },
  { value: 'repair', label: 'Repair', icon: Wrench, color: '#0891b2' },
  { value: 'other', label: 'Other', icon: Store, color: '#2f6bff' },
]
export const category = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1]

export const fmtKm = (km) => km == null ? '' : km < 1 ? `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m` : `${km.toFixed(1)} km`
export const fmtMin = (m) => m == null ? '–' : m < 1 ? '<1 min' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`
export const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export const fmtDate = (d) => {
  const x = new Date(d), today = new Date(), tomorrow = new Date(today.getTime() + 864e5)
  if (x.toDateString() === today.toDateString()) return 'Today'
  if (x.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return x.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}
export const fmtAddress = (a) => a ? [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ') : ''
export const fmtHour = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: m ? '2-digit' : undefined }) }
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
export const timeAgo = (d) => {
  const s = Math.max(0, (Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
export const num = (n) => new Intl.NumberFormat().format(n ?? 0)
export const roleHome = (role) => role === 'admin' ? '/admin' : role === 'staff' ? '/vendor' : '/app'
