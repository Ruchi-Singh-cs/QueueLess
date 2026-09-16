import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff, Trash2 } from 'lucide-react'
import { useNotifications } from '../../lib/notifications.jsx'
import { Button, EmptyState, PageTransition, Alert, stagger } from '../../ui/index.jsx'
import { NotificationCard } from '../../components/Cards.jsx'

export default function Notifications() {
  const { items, markAllRead, clear } = useNotifications()
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  useEffect(() => { const t = setTimeout(markAllRead, 1500); return () => clearTimeout(t) }, [markAllRead])
  return (
    <PageTransition className="container page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div><h1>Notifications</h1><p className="sub">Queue updates, turn alerts and confirmations.</p></div>
        {items.length > 0 && <Button variant="ghost" size="sm" icon={Trash2} onClick={clear}>Clear all</Button>}
      </div>
      {perm === 'default' && <Alert tone="info" icon={Bell} className="mb-4"><div className="between wrap gap-3"><span>Get alerted even when this tab is in the background.</span><Button variant="primary" size="sm" onClick={() => Notification.requestPermission().then(setPerm)}>Enable browser alerts</Button></div></Alert>}
      {perm === 'denied' && <Alert tone="warning" icon={BellOff} className="mb-4">Browser alerts are blocked. In-app notifications still work while QueueLess is open.</Alert>}
      {items.length ? (
        <motion.ul className="stack gap-2" variants={stagger} initial="hidden" animate="show">{items.map((n) => <NotificationCard key={n.id} n={n} />)}</motion.ul>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet.">Join a queue and we'll tell you when your turn is approaching.</EmptyState>
      )}
    </PageTransition>
  )
}
