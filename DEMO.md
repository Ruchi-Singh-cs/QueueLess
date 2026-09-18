# Demo walkthrough

A 10-minute run through QueueLess for someone who has never seen it — a shop owner deciding whether
it's worth using, or a customer wondering why they'd bother. Everything below is already set up by
`npm run demo`; you only ever press **Next**.

---

## Start it

```bash
cd server && npm run demo     # stages the data (re-run any time to reset)
cd server && npm run dev      # API on :4000
cd client && npm run dev      # app on :5173  →  http://localhost:5173
```

Open **two windows** side by side and log in as a different person in each — a normal window and a
private/incognito one works fine. The whole point of the demo is watching one screen react to the other.

| Who | Email | Password | Opens on |
|---|---|---|---|
| Customer | `user@example.com` | `password` | `/queue` — a live ticket |
| Shop owner | `dr-sharma-clinic@example.com` | `password` | `/vendor` — two counters mid-service |
| New shop owner | `newshop@example.com` | `password` | `/vendor` — awaiting verification |
| Admin | `admin@example.com` | `password` | `/admin` |

> The clinic's no-show timer is set to **10 minutes**, with about 9 left on the clock when you stage it,
> so you can watch it count down without it running out mid-demo. Leave the stage sitting much longer
> than that and the queue auto-advances on its own — just re-run `npm run demo` to reset it.

---

## The customer story (5 minutes)

**1. "I don't want to stand in a queue."**
Customer window → **Nearby**. Real shops on a real map, sorted by distance, each showing how many
people are waiting and the estimated wait right now. Filter by category, or search.

**2. Open Dr. Sharma Clinic.**
Live queue state on a public page: currently serving, how many ahead, when you'd likely be seen.
No account needed to look.

**3. "Take a token from where you are."** → **/queue**
The customer already holds **#539**. Point at the three numbers: *currently serving*, *ahead*,
*estimated*. This is the whole product — they're at home, not in a corridor.

**4. Turn on alerts.** Press **"Notify me when it's my turn"**, accept the browser prompt.
This registers a service worker, so the alert arrives **even with the tab closed** — that's the
difference between a notification and a web page you have to keep staring at.

**5. Now switch to the shop owner window and press NEXT on counter 1.**
Watch the customer window without touching it:

- the token flips to **"It's your turn. Go to counter 1 now."**
- a countdown starts — how long they have to reach the counter
- an in-app alert drops in, and it lands in the notification centre

**To show the real OS notification, minimise the customer window first, then press Next.** QueueLess
won't notify you twice: while the tab is visible you get the in-app alert, and the system
notification is only raised when you're actually looking elsewhere. Worth saying out loud — it's the
difference between useful and annoying.

That live hop between two screens is the moment that sells it. Don't rush it.

---

## The shop owner story (5 minutes)

**6. The counter screen.** Owner window → **Live queue**.
Two counters side by side, each with its own token, its own **Next / Skip / Complete**. Counter 1 has
someone who hasn't shown up yet — the timer is ticking. Counter 2 shows **Arrived**, because the staff
tapped it when that person walked up.

Press **Arrived** on counter 1: the timer stops. That's the whole no-show mechanic — nobody gets
skipped by accident, and nobody holds the queue up forever.

Keyboard: `N` next, `S` skip, `C` complete, `1`/`2` to pick a counter. Staff never need the mouse.

**7. "Someone missed their turn. Do they lose their place?"**
Look at **Skipped today** — Rahul, #538. Press **Recall**. He goes back to the *front* of the line with
priority, and his "it's your turn" alert is re-sent. No new number, no argument at the counter.

**8. "When am I actually busy?"** → **Analytics**, switch to **30 days**.
A month of real service history. The heatmap has one obvious dark patch: **Saturday late morning**.
The banner says it outright — *worth a second counter*. Average wait, served vs skipped, tokens per day.

**9. "How do customers find me?"** → **Shop profile** → **Counter QR**.
Download the PNG, print it, tape it to the counter. One scan opens the queue. Walk-ins become
app users without anyone explaining anything.

**10. Settings.** Counters, average service time, and the grace period are all editable here. Change
**Counters** to 3 and go back to Live queue — a third counter appears immediately.

---

## The trust story (2 minutes)

**11. "Can anyone just list a business?"** No.
Log in as `newshop@example.com` → their shop carries a yellow **Awaiting verification** banner. It's
invisible in Nearby and search, and nobody can take a token.

**12. Approve it.** Admin window → **Shops** → *Nova Skin & Hair Studio* → **Approve**.
Go back to **Nearby** and refresh: it's on the map. Suspending a shop hides it again just as fast.

---

## If you only have two minutes

Steps **3 → 5 → 7**. A customer waiting from home, the live hop when their turn comes, and a
recalled no-show keeping their place.

---

## Worth knowing

- **Times are UTC.** Analytics days and the heatmap run midnight-to-midnight UTC, and token numbers
  reset at UTC midnight — so hours may not match your wall clock.
- **Notifications need `localhost` or HTTPS.** That's a browser rule for service workers. `localhost`
  is fine; a plain `http://` LAN address is not, so notifications won't work when demoing from a phone
  over Wi-Fi unless you put HTTPS in front.
- **Notifications need VAPID keys** in `server/.env`. Generate a pair with `npm run vapid` if
  `/api/push/key` reports `enabled: false`.
- **`npm run demo` is safe to re-run.** It rebuilds the clinic's queue from scratch and leaves the
  other 22 shops alone.
- **The data is fictional.** Shops, names and history are generated; the photos are stock.
