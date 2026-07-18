# NOC Dashboard — Corporate Customer Monitoring

Dashboard monitoring jaringan customer corporate real-time dengan topology editor visual, ICMP ping engine, alarm management, RCA & alarm suppression, MTTR analytics, dan export laporan PDF/Excel.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4, React-Flow, Recharts, Socket.io Client |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM, Socket.io, PDFKit, ExcelJS |
| Database | PostgreSQL 16 |
| Real-time | Socket.io WebSocket + EventEmitter |
| Container | Docker, Docker Compose, Nginx (reverse proxy) |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                                                          │
│  ┌─────────────┐     ┌────────────────┐    ┌───────────┐ │
│  │  Frontend   │───▶ │    Backend    │───▶│ PostgreSQL│ │
│  │  (Nginx)    │     │  (Express +    │    │   16      │ │
│  │  :80 → 3000 │     │  Ping Worker)  │    │ :5432→5433│ │
│  │             │     │  :4000         │    │           │ │
│  └─────────────┘     └────────────────┘    └───────────┘ │
│      ▲ API+WS           ▲ ICMP                           │
│      │ reverse proxy    │ ping                           │
└──────┼──────────────────┼────────────────────────────────┘
       │                  │
    Browser            Network Devices
```

---

## 🐳 Docker Deployment (Recommended)

Cara paling mudah untuk menjalankan seluruh stack dalam satu perintah:

```bash
# 1. Clone & masuk ke direktori project
cd dashboard_monitoring

# 2. (Opsional) Salin dan edit konfigurasi environment
cp .env.example .env
# Edit .env jika ingin mengubah password DB, JWT secret, atau port

# 3. Build & jalankan semua container
docker compose up --build -d

# 4. Cek status semua container
docker compose ps

# 5. Lihat live logs
docker compose logs -f
```

Setelah semua container berjalan:
- **Dashboard UI**: http://localhost:3000
- **Backend API**: http://localhost:4000

### Environment Variables

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DB_PASSWORD` | `password` | Password PostgreSQL |
| `DB_PORT` | `5433` | Port PostgreSQL yang di-expose ke host |
| `JWT_SECRET` | `noc-dashboard-secret` | Secret key untuk JWT authentication |
| `BACKEND_PORT` | `4000` | Port backend API di host |
| `FRONTEND_PORT` | `3000` | Port frontend UI di host |

### Docker Commands

```bash
# Lihat status container
docker compose ps

# Lihat logs real-time
docker compose logs -f
docker compose logs -f backend    # hanya backend

# Restart satu service
docker compose restart backend

# Stop semua container
docker compose down

# Stop & hapus semua data (⚠️ HATI-HATI! Data DB akan hilang)
docker compose down -v

# Rebuild setelah perubahan kode
docker compose up --build -d
```

---

## 🛠️ Local Development (Tanpa Docker)

Untuk development dengan hot-reload:

```bash
# 1. Start database saja via Docker
docker compose up -d db

# 2. Backend (terminal 1)
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev                # http://localhost:4000

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev                # http://localhost:3000
```

---

## Default Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin (full access) |
| `operator` | `operator123` | Operator (manage alarms, export) |
| `viewer` | `viewer123` | Viewer (read-only) |

## Project Structure

```
dashboard_monitoring/
├── docker-compose.yml         # Docker stack orchestration
├── .env.example               # Environment variables template
│
├── backend/
│   ├── Dockerfile             # Multi-stage build (Node.js + Alpine)
│   ├── prisma/                # Schema, migrations, seed
│   ├── src/
│   │   ├── lib/               # Prisma client, ping, event emitter, notifications
│   │   ├── middleware/        # JWT auth + RBAC middleware
│   │   ├── routes/            # API routes (auth, nodes, alarms, events, export,
│   │   │                      #   customers, notifications, reports, audit)
│   │   ├── workers/           # ICMP ping monitoring engine + RCA suppression
│   │   └── server.ts          # Entry point
│   └── package.json
│
├── frontend/
│   ├── Dockerfile             # Multi-stage build (Vite → Nginx)
│   ├── nginx.conf             # Reverse proxy config (API + WebSocket)
│   ├── src/
│   │   ├── components/        # Layout, shared components
│   │   ├── context/           # Auth context
│   │   ├── lib/               # API client, Socket.io client
│   │   ├── pages/             # Dashboard, Topology, Alarms, History,
│   │   │                      #   Reports, Users, Maintenance, Audit, Login
│   │   └── App.tsx            # Router
│   └── package.json
│
└── docs/                      # Technical documentation
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Current user info |
| GET/POST | `/api/auth` | List/create users (admin) |
| PUT/DELETE | `/api/auth/:id` | Update/delete user (admin) |
| GET/POST/PUT/DELETE | `/api/nodes` | CRUD nodes |
| POST | `/api/nodes/import` | Bulk import nodes |
| GET/POST | `/api/nodes/topology/export\|import` | Export/import full topology JSON |
| GET | `/api/events/summary` | Dashboard summary + SLA + alarm trends |
| GET | `/api/events/history/:id` | Node history stats |
| GET | `/api/alarms` | List alarms (paginated, filterable) |
| PUT | `/api/alarms/:id/resolve` | Resolve alarm |
| GET | `/api/customers` | List customers |
| GET | `/api/export/alarms/xlsx\|csv\|pdf` | Export alarms |
| GET | `/api/reports/sla` | SLA availability report |
| GET | `/api/reports/sla/pdf\|xlsx` | Download SLA report |
| GET | `/api/reports/mttr` | MTTR analytics data |
| GET | `/api/reports/mttr/pdf\|xlsx` | Download MTTR report |
| GET/PUT | `/api/notifications` | User notification settings |
| GET | `/api/audit` | Audit trail logs (admin) |

## Features

- **Dashboard** — real-time summary cards, recent events feed, and WebSocket auto-updates
- **Latency Heatmap Grid** — compact visual overview of all nodes colored by latency (Low / Warning / High / Down)
- **24-Hour Alarm Trend** — area chart tracking Warning and Down alarms over the last 24 hours
- **Customer SLA Leaderboard** — 30-day contract compliance ranking with progress bars
- **Topology Editor** — drag-and-drop network map with React-Flow, status colors, and device palette
- **POP/Network Nested Maps** — recursive parent-child POP drill-downs via double-click
- **Topology Search & Auto-Focus** — instant search with opacity fading and smooth camera pan
- **Connection Link Quality** — color-coded animated links representing live connection health
- **RCA & Alarm Suppression** — suppress child alarms when parent POP is down, preventing alarm storms
- **ICMP Monitoring** — background ping worker with configurable intervals and threshold detection
- **Maintenance Windows** — schedule maintenance times per node to bypass alerts temporarily
- **Audit Logs** — full audit trail of system configuration changes (Admin only)
- **MTTR Analytics** — Mean Time To Resolve with daily trends, device breakdowns, and PDF/Excel export
- **SLA Reports** — per-customer availability reports with PDF and Excel downloads
- **Notifications** — email webhooks and Slack channel alarm integrations
- **Dark/Light Mode** — system-wide theme with persistent preference
- **RBAC** — Admin, Operator, and Viewer roles

