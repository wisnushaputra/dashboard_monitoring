# NOC Dashboard — Corporate Customer Monitoring

Dashboard monitoring jaringan customer corporate real-time dengan topology editor visual, ICMP ping engine, alarm management, dan export laporan.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4, React-Flow, Recharts, Socket.io Client |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM, Socket.io |
| Database | PostgreSQL 16 |
| Real-time | Socket.io WebSocket + EventEmitter |

## Quick Start

```bash
# 1. Start database
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env   # edit if needed
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts   # seed: admin/admin123, operator/operator123, viewer/viewer123
npm run dev              # http://localhost:4000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:3000 (or http://localhost:3002 if 3000 is occupied)
```

## Default Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin (full access) |
| operator | operator123 | Operator (manage alarms, export) |
| viewer | viewer123 | Viewer (read-only) |

## Project Structure

```
backend/
├── prisma/            # Schema, migrations, seed
├── src/
│   ├── lib/           # Prisma client, ping utility, event emitter, notifications
│   ├── middleware/     # JWT auth + RBAC middleware
│   ├── routes/        # API routes (auth, nodes, alarms, events, export, customers, notifications)
│   ├── workers/       # Ping monitoring engine
│   └── server.ts      # Entry point
frontend/
├── src/
│   ├── components/    # Layout, shared components
│   ├── context/       # Auth context
│   ├── lib/           # API client, Socket.io client
│   ├── pages/         # Dashboard, Topology, Alarms, History, Users, Login
│   └── App.tsx        # Router
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login (returns JWT) |
| GET | /api/auth/me | Current user info |
| GET/POST | /api/auth | List/create users (admin) |
| PUT/DELETE | /api/auth/:id | Update/delete user (admin) |
| GET/POST/PUT/DELETE | /api/nodes | CRUD nodes |
| POST | /api/nodes/import | Bulk import nodes |
| GET | /api/events/summary | Dashboard summary |
| GET | /api/events/history/:id | Node history stats |
| GET | /api/alarms | List alarms (paginated, filterable) |
| PUT | /api/alarms/:id/resolve | Resolve alarm |
| GET | /api/customers | List customers |
| GET | /api/export/alarms/xlsx\|csv\|pdf | Export alarms |
| GET/PUT | /api/notifications | User notification settings |

## Docker Deployment

```bash
docker compose up --build -d
# Frontend: http://localhost:3000 (or http://localhost:3002 if port 3000 is occupied)
# Backend API: http://localhost:4000
```

## Features

- **Dashboard** — real-time summary cards, recent events feed, and WebSocket auto-updates.
- **Latency Heatmap Grid** — compact visual overview of all nodes' status colored dynamically by latency thresholds (Low, Warning, High, Down).
- **24-Hour Alarm Trend** — area trend chart highlighting Warning and Down alarms over the last 24 hours.
- **Customer SLA Leaderboard** — real-time contract compliance tracking of all corporate customers over 30 days.
- **Topology Editor** — drag-and-drop network map with React-Flow canvas, status colors, and device palette.
- **POP/Network Nested Maps** — recursive self-relations for parent POP network nodes, enabling double-click drill-downs.
- **Topology Search & Auto-Focus** — instant search box with visual opacity fading and smooth viewport panning.
- **Connection Link Quality** — color-coded links (Emerald Green, Amber, Red dashed) representing live connection status.
- **RCA & Alarm Suppression** — suppress down alarms on child nodes if the parent POP is Down, preventing alarm storms.
- **ICMP Monitoring** — background ping worker with configurable intervals, custom threshold rules, and status triggers.
- **Maintenance Windows** — schedule offline maintenance times per node to temporarily bypass alerts and notifications.
- **Audit Logs** — full audit trail of system configuration changes (Admin only).
- **MTTR Analytics Reports** — Mean Time To Resolve analytics with daily trend charts, device type charts, and PDF/Excel downloads.
- **SLA PDF & Excel Exports** — download compiled reports containing availability compliance and downtime details.
- **Notifications** — email webhooks and Slack channel alarm logging integrations.
- **Dark/Light Mode** — system-wide theme customization with persistent memory.
- **RBAC** — Admin, Operator, and Viewer roles.
