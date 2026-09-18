# QueueLess — Skip the wait.

Virtual queue management: find nearby businesses on a map, see the live queue, join remotely, get a token, track your position in real time, get notified when your turn is near, and arrive when it matters. Businesses run their queue from a one-tap counter screen.

```
Dr. Sharma Clinic
Currently serving: #21   Your token: #27   People ahead: 6   ETA: 35 min
```

## Stack

- **server/** — Node 20+, Express 5, Mongoose 8 (2dsphere geo queries), Socket.IO 4, JWT, bcryptjs. ESM. No `dotenv` (`node --env-file`). Vite proxy in dev; Express serves `client/dist` in prod (same origin).
- **client/** — Vite + React 18, react-router 6, framer-motion, lucide-react (single icon set), socket.io-client, maps via OpenStreetMap/Leaflet (default, free) or Google Maps JavaScript API (Places + Marker) when a key is set. Plain CSS design system (`src/styles/`), light + dark mode.

## Run with Docker

Nothing to install but Docker itself — no Node, no MongoDB, no `.env` to fill in:

```bash
docker compose up --build     # http://localhost:4000
```

One image serves the API, the WebSocket and the built front end on a single port; MongoDB runs
beside it with a named volume, so your data survives `docker compose down`. The first start seeds
the demo shops and stages the walkthrough in [DEMO.md](DEMO.md) — log in with any account listed
there, password `password`.

```bash
docker compose down           # stop (data kept)
docker compose down -v        # stop and wipe the database
docker compose exec app node demo.js    # re-stage the demo without restarting
docker compose run --rm app node vapid.js   # generate VAPID keys for push
```

Notifications are off until you set VAPID keys: generate a pair with the command above, put them in
a `.env` next to `docker-compose.yml` as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, then
`docker compose up -d`. Without them the app runs fine and simply reports push as unavailable.
`JWT_SECRET` defaults to a placeholder — override it for anything beyond a local demo.

## Run without Docker

```bash
# 1. server (embedded MongoDB persists in server/data — no install needed)
cd server && cp .env.example .env && npm install
npm run seed      # demo shops around Kanpur + accounts (password: "password"); safe to re-run
npm run dev       # http://localhost:4000

# 2. client (separate terminal)
cd client && cp .env.example .env   # add VITE_GOOGLE_MAPS_API_KEY to enable Google Maps
npm install && npm run dev          # http://localhost:5173

# production: cd client && npm run build, then the server serves it on :4000
# tests: cd server && npm test
```

Demo logins after `npm run seed` (password `password`): `admin@example.com` (admin), `user@example.com` (customer), `dr-sharma-clinic@example.com` / `glow-salon@example.com` / … (vendors).

### Environment

`server/.env`
```
PORT=4000
# MONGO_URI=mongodb://127.0.0.1:27017/queueless   # unset → embedded db in server/data
JWT_SECRET=change-me
ADMIN_EMAIL=admin@example.com   # registering with this email yields role=admin
# SEED=1                        # seed demo data on startup
```

`client/.env`
```
VITE_GOOGLE_MAPS_API_KEY=       # Maps JavaScript API + Places API (New); restrict to your domains
VITE_GOOGLE_MAPS_MAP_ID=        # optional cloud map style id (defaults to DEMO_MAP_ID)
```
Without a Google key the app uses the free **OpenStreetMap** provider: CARTO basemap tiles via Leaflet, Nominatim for address search in the vendor location picker (public endpoint, ~1 request/s — fine for a demo), Google Maps URLs for directions. Nothing to configure.

## Roles & routes

| role | client routes | can |
|---|---|---|
| guest | `/` landing, `/nearby`, `/shop/:id`, `/login`, `/register` | browse shops + live queues on the map |
| user | `/app`, `/queue`, `/t/:tokenId`, `/appointments`, `/notifications`, `/profile` | join/leave queues, book/cancel appointments, live token tracking, notifications |
| staff (vendor) | `/vendor` overview, `/queue`, `/appointments`, `/shop`, `/location`, `/services`, `/analytics`, `/settings` | create shops, manage **own** queue (next/skip/complete/pause), shop profile, map pin, services, check-in appointments, stats |
| admin | `/admin` dashboard, `/shops`, `/users`, `/vendors`, `/queues`, `/appointments`, `/analytics`, `/settings` | everything, on any shop; change user roles |

Registration accepts `role` of `user` or `staff`. `email === ADMIN_EMAIL` → admin.

## Data model

```
User        { name, email (unique), passwordHash, role: user|staff|admin, timestamps }
Queue       { name, description, owner → User, avgServiceMinutes = 5, isOpen = true, counter, counterDate, currentToken → Token,
  (= shop)    category: medical|salon|bank|government|repair|other, phone, email, image,
              address { street, city, state, pincode }, hours { open '09:00', close '18:00' },
              services: [{ name, minutes }],
              location: GeoJSON Point { type: 'Point', coordinates: [lng, lat] } }   index: 2dsphere on location
Token       { queue, user, number, priority, service, status: waiting|serving|served|skipped|left, calledAt, doneAt }
Appointment { queue, user, at, service, note, status: booked|checked_in|cancelled|completed, token }
```

## Queue rules

- Token numbers are per-queue and reset daily (UTC). One active token per user per queue (409 otherwise). Closed queue → 400.
- Waiting order: `priority` desc, then `number` asc. Checked-in appointments become priority tokens.
- **Next**: current `serving` → `served`, rolling average `avg = 0.7*avg + 0.3*minutes`, first waiting → `serving`. **Skip**: same but `skipped`. **Complete**: current → `served` without calling anyone.
- Ticket math: `ahead = waiting before me + (1 if someone is being served)`, `etaMinutes = round(ahead * avgServiceMinutes)`.

## HTTP API (JSON; `Authorization: Bearer <jwt>`)

| method | path | auth | notes |
|---|---|---|---|
| POST | /api/auth/register · /login | – | `{ token, user }` |
| GET · PATCH | /api/auth/me | any | PATCH `{ name?, password? }` |
| GET | /api/queues | optional | `?q=&category=&open=1` — list with live counts |
| GET | /api/queues/nearby | optional | `?lat&lng&radius(km, default 5)&q&category` — MongoDB `$geoNear`, sorted by distance, adds `distanceKm` |
| POST | /api/queues | staff/admin | `{ name, category?, description?, avgServiceMinutes? }` |
| GET | /api/queues/:id | optional | `QueueState` (names only for owner/admin) |
| PATCH | /api/queues/:id | owner/admin | any of name, description, avgServiceMinutes, isOpen, category, phone, email, image, address{}, hours{}, services[], location{lat,lng} |
| POST | /api/queues/:id/join | any | `{ service? }` → `{ ticket }` |
| POST | /api/queues/:id/next · /skip · /complete | owner/admin | `QueueState` |
| GET | /api/queues/:id/stats | owner/admin | today's totals, avg wait, per-hour |
| GET | /api/tokens/mine · /history · /:id | any | tickets |
| DELETE | /api/tokens/:id | owner | leave |
| GET · POST · PATCH | /api/appointments | any | `{ queue, at, service?, note? }`, PATCH `{ status }` |
| GET | /api/admin/stats · /users | admin | platform stats (7-day series, recent activity, busiest shops) |
| PATCH | /api/admin/users/:id | admin | `{ role }` |

`/api/shops/*` is an alias of `/api/queues/*`.

`QueueSummary` adds `category, image, phone, email, address, hours, services, location {lat,lng}, etaMinutes, distanceKm?` to the original fields. `Ticket` adds `service, waitingNumbers, queue.category/address/location`.

## Socket.IO

Guests may connect without a token (to watch public queues); a bad token is rejected. `queue:watch`/`queue:unwatch` (queueId) join/leave room `queue:<id>`. After every mutation the server emits `queue:update` `{ queueId, name, isOpen, avgServiceMinutes, currentNumber, waitingNumbers }` to the room and `ticket:update` (full `Ticket`) to each affected user. The client derives in-app notifications (approaching / next / your turn / completed / skipped) from `ticket:update`, shows toasts, and uses the browser Notification API when permitted.

## Layout

```
server/src   app.js (express + socket)  db.js (mongo / embedded)  index.js  auth.js  models.js  queue.js
             routes/ auth queues tokens appointments admin        seed.js   test/queue.test.js
client/src   App.jsx (routes, lazy chunks)  api.js  auth.jsx
             styles/  base.css (tokens, dark mode, utilities)  ui.css (components)  pages.css
             ui/      index.jsx (Button, Input, Badge, Card, StatCard, Tabs, Skeleton, EmptyState…)  Modal.jsx (Modal, Sheet, Drawer)  Toast.jsx
             lib/     hooks.js (useFetch, useQueueWatch, useTicketUpdates)  geo.js  maps.js  theme.jsx  notifications.jsx  format.js
             components/ Layout (Navbar, BottomNav, DashboardLayout)  Map (GoogleMap + fallback)  LocationPicker  LocationPrompt
                         Cards (ShopCard, TokenCard, QueueTimeline, AppointmentCard, NotificationCard, ServiceCard)  JoinQueue  BookAppointment  SearchPalette  Chart
             pages/   Landing Login Nearby Shop  user/(Home Ticket Appointments Notifications Profile)
                      vendor/(VendorContext Overview LiveQueue Appointments ShopProfile Location Services Analytics Settings)  admin/(Dashboard Lists)
```
