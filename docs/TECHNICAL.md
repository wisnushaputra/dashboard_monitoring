# Technical Documentation — NOC Dashboard Monitoring

## Architecture Overview

```
                        ┌──────────────────────────┐
                        │     PostgreSQL DB         │
                        │  (Prisma ORM)             │
                        └────┬─────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐
        │  Routes     │ │  Ping     │ │ Notif      │
        │  (7 files)  │ │  Worker   │ │ Lib        │
        │  Express    │ │  (5s loop)│ │ (webhook)  │
        └─────┬──────┘ └────┬──────┘ └─────┬──────┘
              │              │              │
              │        ┌─────▼──────┐       │
              │        │ eventEmitter│       │
              │        │ (EventBus) │       │
              │        └─────┬──────┘       │
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │   Socket.io     │
                    │   (Server)      │
                    │   port 4000     │
                    └────────┬────────┘
                             │
                    WebSocket clients
                    (React frontend)
```

### Components

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | React 19 + Vite 8 + Tailwind CSS 4 | SPA UI, real-time updates, topology editor |
| **Backend** | Express 4 + TypeScript | REST API, JWT auth, Socket.io server |
| **Database** | PostgreSQL + Prisma ORM | Data persistence, migrations |
| **Monitoring** | `child_process.exec('ping')` | ICMP reachability checks |
| **Pub/Sub** | Node.js `EventEmitter` | In-process event bus (WS bridge) |
| **WebSocket** | Socket.io | Bi-directional real-time events |
| **Notifications** | `fetch()` (webhooks) + `console.log` (email) | Multi-channel alert dispatch |

## Data Flow

### ICMP Monitoring → UI Real-time Update

```
pingWorker (every 5s)
  │
  ├─ pingFast(ip) → 1 packet → { alive, latencyMs, packetLoss }
  │
  ├─ No status change
  │   └─ Update latency metrics in DB only
  │
  └─ Status changed (up→down, down→up, warning)
      ├─ ping(ip, 4) → detailed metrics (avg/min/max/packetLoss %)
      ├─ Update Node status in DB
      ├─ Create EventLog in DB
      ├─ If down:
      │   ├─ Create Alarm (status='active') in DB
      │   ├─ emit('alarm:created') → EventEmitter
      │   └─ sendNotifications() → email/webhook/Slack
      ├─ If recovered to up:
      │   ├─ Resolve Alarm (status='resolved', duration) in DB
      │   ├─ emit('alarm:resolved') → EventEmitter
      │   └─ sendNotifications()
      └─ emit('node:status') → EventEmitter
            │
            ▼
      server.ts (Socket.io bridge)
            │
            ├─ io.emit('node:status', data)
            ├─ io.emit('alarm:created', data)
            └─ io.emit('alarm:resolved', data)
                  │
                  ▼
            Frontend socket listeners
            ├─ Dashboard → refresh summary cards + events
            ├─ Topology → update node status colors + animations
            └─ Alarms → refresh alarm list
```

### REST API Request Flow

```
Client → Express Router → authMiddleware (JWT verify) → roleMiddleware (optional RBAC)
  → Route Handler → Prisma Query → PostgreSQL
  → JSON Response (with pagination meta when applicable)
```

## Backend Module Guide

### Entry Point: `backend/src/server.ts`

- Creates Express + HTTP server + Socket.io
- Registers 7 route groups under `/api/`
- Bridges `EventEmitter` events to Socket.io broadcasts
- Starts `pingWorker` on startup
- Exports `{ app, server, io }` for testing

### Routes (`backend/src/routes/`)

| File | Base Path | Description |
|------|-----------|-------------|
| `auth.ts` | `/api/auth` | Login, user CRUD (admin-only) |
| `nodes.ts` | `/api/nodes` | Node CRUD, import, export |
| `alarms.ts` | `/api/alarms` | Alarm list (paginated), resolve |
| `events.ts` | `/api/events` | Event logs, dashboard summary, node history |
| `customers.ts` | `/api/customers` | Customer + Site CRUD |
| `exports.ts` | `/api/export` | XLSX/CSV/PDF alarm exports |
| `notifications.ts` | `/api/notifications` | Per-user notification settings |

### Middleware: `backend/src/middleware/auth.ts`

- `authMiddleware`: Extracts + verifies JWT from `Authorization: Bearer <token>`
- `roleMiddleware(...roles)`: Restricts access by role (returns 403)
- `signToken(payload)`: Creates 24h JWT

### Monitoring Engine: `backend/src/workers/pingWorker.ts`

- **Start**: `startPingWorker()` — fetches enabled nodes, runs on 5s interval
- **Scheduling**: Probabilistic stagger — nodes with interval < 5s are skipped, others checked with weighted probability
- **Per-node state**: In-memory `Map<nodeId, NodeState>` tracks `consecutiveFailures`, `lastStatus`, active `alarmId`
- **Thresholds**: 2 consecutive failures → `down`, latency > 100ms → `warning`
- **On change**: Detailed ping (4 packets), DB update, EventLog, Alarm CRUD, notifications, event bus emit

### Ping Utility: `backend/src/lib/ping.ts`

- `ping(ip, count=4)`: Full detail — avg/min/max latency, packet loss %
- `pingFast(ip)`: Single packet, used every cycle
- Cross-platform: supports Linux (`-c`) and Windows (`-n`) ping syntax

### Event Bus: `backend/src/lib/eventEmitter.ts`

- Singleton `EventEmitter` with max 100 listeners
- Events: `node:status`, `alarm:created`, `alarm:resolved`

### Notifications: `backend/src/lib/notifications.ts`

- Queries all `NotificationSetting` rows per user
- Dispatches to: console (email placeholder), HTTP POST (webhook), Slack webhook

### Database Schema: `backend/prisma/schema.prisma`

10 models:

| Model | Table | Key Fields | Purpose |
|-------|-------|------------|---------|
| User | `users` | username, passwordHash, role | Authentication + RBAC |
| Customer | `customers` | name, code | Organize nodes by customer |
| Site | `sites` | name, location | Group nodes by physical location |
| Node | `nodes` | ipAddress, deviceType, status, latencyMs, x/y | Monitored device |
| Connection | `connections` | fromNodeId, toNodeId, label | Topology edges |
| Topology | `topologies` | name, data (JSON) | Saved canvas states |
| Alarm | `alarms` | nodeId, status, startTime, endTime | Active/resolved alerts |
| EventLog | `event_logs` | nodeId, eventType, latencyMs, timestamp | Monitoring history |
| NotificationSetting | `notification_settings` | userId, emailEnabled, webhookUrl, slackWebhook | Per-user notification prefs |

### Design Decisions

- **PostgreSQL over SQLite**: Required for concurrent writes from ping worker + API
- **EventEmitter over Redis**: Single-instance deployment, zero external deps
- **System ping over npm lib**: No extra dependencies, more reliable ICMP
- **@xyflow/react over react-flow**: Active maintained fork
- **Probabilistic scheduling**: Spreads ping checks across 5s window instead of thundering herd
- **Notifications stored per-user**: UPSERT pattern, defaults auto-created on read

## Frontend Module Guide

### Entry: `frontend/src/main.tsx`

Mounts `<App />` in StrictMode with global CSS.

### Routing: `frontend/src/App.tsx`

- `BrowserRouter` with `AuthProvider`
- `ProtectedRoute` wrapper — checks auth, wraps children in `<Layout>`
- Routes: `/login` (public), `/` (Dashboard), `/topology`, `/alarms`, `/history`, `/users` (admin)

### Auth Context: `frontend/src/context/AuthContext.tsx`

- On mount: validates existing token via `/api/auth/me`
- Exposes: `{ user, login, logout, loading }`

### Pages

| Page | File | Description |
|------|------|-------------|
| Login | `Login.tsx` | Username/password form, error display |
| Dashboard | `Dashboard.tsx` | Summary cards + recent events, 30s poll + WS |
| Topology | `Topology.tsx` | ReactFlow editor, drag-drop palette, WS live status |
| Alarms | `Alarms.tsx` | Paginated list, filters, export, resolve modal |
| History | `History.tsx` | Latency chart, downtime Gantt, event timeline |
| Users | `Users.tsx` | Admin CRUD table + modal |

### API Client: `frontend/src/lib/api.ts`

- Centralized fetch wrapper with Bearer token injection
- Auto-redirect to `/login` on 401
- Export endpoints use `&token=` query param for direct download

### Socket Client: `frontend/src/lib/socket.ts`

- Singleton `io('/')` with WebSocket + polling fallback
- Events: `node:status`, `alarm:created`, `alarm:resolved`

### Layout: `frontend/src/components/Layout.tsx`

- Sidebar with NavLink active states
- Dark mode toggle (localStorage + `prefers-color-scheme`)
- Alarm sound toggle
- Admin-only "Users" nav item
- Mobile-responsive (off-canvas sidebar)

## How to Extend

### Add a New Monitoring Type (e.g., SNMP, HTTP)

1. Create `backend/src/workers/snmpWorker.ts` exporting `startSnmpWorker()`
2. Use `eventEmitter` to emit `node:status` / `alarm:created` / `alarm:resolved`
3. Call `startSnmpWorker()` from `server.ts`
4. Add `monitorType` filter to node CRUD routes
5. Frontend: add device-type visuals in Topology.tsx

### Add a New Export Format

1. Add route in `backend/src/routes/exports.ts`
2. Stream response with appropriate `Content-Type` + `Content-Disposition`
3. Export URL already uses `&token=` auth pattern — follow existing convention

### Add a New Notification Channel

1. Add field in `NotificationSetting` model + Prisma migration
2. Add dispatch logic in `backend/src/lib/notifications.ts`
3. Frontend: add toggle/input in notification settings page

### Add a New Dashboard Widget

1. Add API endpoint in `backend/src/routes/events.ts`
2. Frontend: create widget component, add to `Dashboard.tsx`

## Deployment

See `README.md` for local and Docker deployment instructions.

Key environment variables:
```
DATABASE_URL  — PostgreSQL connection string
JWT_SECRET    — Secret key for token signing
PORT          — Backend listen port (default: 4000)
```

Docker Compose exposes PostgreSQL on port 5433 (host side) to avoid local conflicts.
