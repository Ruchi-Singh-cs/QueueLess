import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff, BellRing, Trash2 } from 'lucide-react'
import { useNotifications } from '../../lib/notifications.jsx'
import { pushState, subscribePush, unsubscribePush } from '../../lib/push.js'
import { Button, EmptyState, PageTransition, Alert, stagger } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'
import { NotificationCard } from '../../components/Cards.jsx'

export default function Notifications() {
  const { items, markAllRead, clear, refreshPush } = useNotifications()
  const toast = useToast()
  const [push, setPush] = useState(null) // null while we're still checking
  const [busy, setBusy] = useState(false)
  useEffect(() => { const t = setTimeout(markAllRead, 1500); return () => clearTimeout(t) }, [markAllRead])
  useEffect(() => { pushState().then(setPush) }, [])

  async function toggle() {
    setBusy(true)
    try {
      if (push === 'on') { await unsubscribePush(); toast.info('Background alerts turned off.') }
      else { await subscribePush(); toast.success('Background alerts on.', { description: "We'll ping this device when your turn is near." }) }
    } catch (e) { toast.error(e.message) } finally {
      setPush(await pushState())
      refreshPush()
      setBusy(false)
    }
  }
  return (
    <PageTransition className="container page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div><h1>Notifications</h1><p className="sub">Queue updates, turn alerts and confirmations.</p></div>
        {items.length > 0 && <Button variant="ghost" size="sm" icon={Trash2} onClick={clear}>Clear all</Button>}
      </div>
      {push === 'off' && <Alert tone="info" icon={Bell} className="mb-4"><div className="between wrap gap-3"><span>Get alerted when your turn is near — even with QueueLess closed.</span><Button variant="primary" size="sm" loading={busy} onClick={toggle}>Turn on background alerts</Button></div></Alert>}
      {push === 'on' && <Alert tone="success" icon={BellRing} className="mb-4"><div className="between wrap gap-3"><span>Background alerts are on for this device.</span><Button variant="ghost" size="sm" loading={busy} onClick={toggle}>Turn off</Button></div></Alert>}
      {push === 'denied' && <Alert tone="warning" icon={BellOff} className="mb-4">Notifications are blocked for this site in your browser settings. In-app alerts still work while QueueLess is open.</Alert>}
      {push === 'unsupported' && <Alert tone="warning" icon={BellOff} className="mb-4">This browser can't do background notifications. In-app alerts still work while QueueLess is open.</Alert>}
      {push === 'unconfigured' && <Alert tone="info" icon={BellOff} className="mb-4">Background alerts aren't set up on this server yet. In-app alerts still work while QueueLess is open.</Alert>}
      {items.length ? (
        <motion.ul className="stack gap-2" variants={stagger} initial="hidden" animate="show">{items.map((n) => <NotificationCard key={n.id} n={n} />)}</motion.ul>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet.">Join a queue and we'll tell you when your turn is approaching.</EmptyState>
      )}
    </PageTransition>
  )
}
