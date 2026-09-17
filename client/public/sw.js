/* QueueLess service worker — web push only. It never intercepts fetches, so it changes no caching. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const windows = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true })

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data.json() } catch {}
  e.waitUntil((async () => {
    // a visible tab already showed this via the live socket — don't notify twice
    if ((await windows()).some((c) => c.visibilityState === 'visible')) return
    await self.registration.showNotification(d.title || 'QueueLess', {
      body: d.body || '',
      tag: d.tag || 'queueless',
      renotify: true,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [90, 50, 90],
      data: { url: d.url || '/' },
    })
  })())
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil((async () => {
    const all = await windows()
    const open = all.find((c) => new URL(c.url).pathname === url)
    if (open) return open.focus()
    if (all[0]) {
      await all[0].focus()
      try { return await all[0].navigate(url) } catch {} // navigate() throws on uncontrolled clients
    }
    return self.clients.openWindow(url)
  })())
})

// The browser can rotate a subscription on its own. The app re-syncs on every load (see lib/push.js),
// so all we do here is drop the stale one — re-subscribing needs a logged-in user, which we don't have.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    for (const c of await windows()) c.postMessage({ type: 'push-subscription-changed' })
  })())
})
