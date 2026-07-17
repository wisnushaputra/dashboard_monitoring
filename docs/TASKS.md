# Checklist Tugas Pengembangan Project Dashboard Monitoring Customer Corporate

Dokumen ini menguraikan daftar tugas pengembangan yang akan dilakukan, dari frontend hingga pengujian dan deployment, sesuai dengan PRD yang telah disepakati.

## Fase 1: Inisialisasi Proyek & Backend Core

### 1.1 Setup Proyek & Lingkungan
- [x] Buat struktur folder monorepo atau dua folder terpisah (`frontend`, `backend`).
- [x] Inisialisasi proyek `backend`: Node.js, TypeScript, Express/Fastify.
- [x] Inisialisasi proyek `frontend`: React 18, Vite, TypeScript, Tailwind CSS.
- [x] Konfigurasi `package.json` untuk script dev dan build.
- [ ] Setup Git repository dan `.gitignore`.
- [~] Konfigurasi Docker (Dockerfile untuk frontend & backend, docker-compose.yml untuk dev).

### 1.2 Database & ORM
- [x] Setup PostgreSQL database lokal (via Docker Compose).
- [x] Konfigurasi Prisma ORM di `backend`.
- [x] Desain schema database (`prisma/schema.prisma`) untuk:
    - [x] User (id, username, password_hash, role: Admin/Operator/Viewer)
    - [x] Node (id, name, ip_address, device_type, location, description, monitoring_interval, monitor_type, monitor_config JSON, customer_id, site_id)
    - [x] Topology (id, name, data JSON - untuk menyimpan posisi node dan koneksi)
    - [x] Alarm (id, node_id, status: active/resolved, start_time, end_time, duration, cause, recovery_note)
    - [x] Event Log (id, node_id, event_type: up/down/warning, timestamp, message)
    - [x] Customer & Site (jika entitas ini berdiri sendiri)
- [x] Jalankan migrasi database awal (`prisma migrate dev`).

### 1.3 Autentikasi & Otorisasi (Backend)
- [x] Implementasi API Register User (Admin saja yang bisa menambah User baru).
- [x] Implementasi API Login User (mengembalikan JWT).
- [x] Buat Middleware Autentikasi (verifikasi JWT).
- [x] Buat Middleware Otorisasi (Role-Based Access Control: Admin, Operator, Viewer).

### 1.4 API Manajemen User (Backend)
- [x] API untuk Admin: CRUD User.
- [x] API untuk Admin: Mengelola peran (role) user.

---

## Fase 2: Backend Fungsionalitas Inti & Real-time

### 2.1 API Node (Backend)
- [x] Implementasi API CRUD untuk Node.
- [x] Implementasi API untuk import data node dari spreadsheet (menerima file Excel/CSV, parsing, dan bulk insert).
- [x] Implementasi API untuk export data node.

### 2.2 Monitoring Engine (Backend Worker)
- [x] Buat Worker terpisah (Node.js worker thread atau proses terpisah).
- [x] Worker: Baca daftar Node dari database.
- [x] Worker: Lakukan ICMP Ping ke IP Address setiap Node sesuai `monitoring_interval`.
- [~] Worker: Log hasil ping (latency, packet loss).
- [x] Worker: Tentukan status Node (Hijau/Kuning/Merah) berdasarkan hasil ping dan ambang batas.
- [x] Worker: Deteksi perubahan status Node (Down Time, Up Time, Warning).
- [x] Worker: Simpan `Alarm` dan `Event Log` ke database saat perubahan status terjadi.
- [ ] Worker: Publikasikan perubahan status Node dan Alarm ke Redis Pub/Sub.

### 2.3 WebSocket Server (Backend)
- [x] Integrasikan WebSocket server (Socket.io) ke backend Express/Fastify.
- [ ] Langganan (subscribe) ke Redis Pub/Sub untuk menerima notifikasi dari Monitoring Engine.
- [x] Kirim (emit) perubahan status Node (`nodeStatus`) dan Alarm (`alarmCreated`, `alarmResolved`) ke semua klien frontend yang terhubung.

### 2.4 API Alarm & Event Log (Backend)
- [x] API untuk mengambil daftar Alarm (dengan filter: customer, site, perangkat, status, rentang waktu, paginasi).
- [x] API untuk mengambil daftar Event Log (dengan filter: customer, site, perangkat, status, rentang waktu, paginasi).
- [x] API untuk Operator: Menambahkan `recovery_note` pada Alarm yang telah selesai.
- [ ] API untuk Operator: Mengontrol notifikasi (misal: toggle suara alarm).

### 2.5 API Export Data (Backend)
- [x] Endpoint export untuk Alarm & Event Log ke format XLSX.
- [x] Endpoint export untuk Alarm & Event Log ke format CSV.
- [x] Endpoint export untuk Alarm & Event Log ke format PDF (membutuhkan template).

---

## Fase 3: Pengembangan Frontend (UI/UX)

### 3.1 Layout & Dashboard Utama
- [x] Implementasi layout dasar (Sidebar navigasi, Top Navigation Bar).
- [x] Halaman Login & Logout.
- [x] Halaman Dashboard Overview:
    - [x] Tampilkan kartu metrik: Total Site, Node Online, Node Offline, Total Alarm Aktif.
    - [x] Widget Recent Events (tabel kejadian terbaru).
    - [x] Implementasi toggle Dark/Light Mode.
    - [x] Tombol toggle suara alarm.
    - [x] Auto Refresh Dashboard (menggunakan polling atau WebSocket).

### 3.2 Topology Editor (Frontend)
- [x] Integrasi pustaka `React-Flow` (atau serupa) untuk kanvas interaktif.
- [ ] Palet perangkat (NodePalette) untuk drag-and-drop node.
- [x] Fungsi drag-and-drop node ke kanvas.
- [x] UI untuk menggambar koneksi antar node.
- [~] UI untuk mengedit properti Node (modal untuk Nama, IP, Tipe, Interval, dll.).
- [x] Tampilkan status Node (Hijau/Kuning/Merah) secara visual.
- [x] Animasi visual alarm (ikon berkedip merah) untuk Node Down.
- [x] Simpan dan muat topologi dari API backend.

### 3.3 Halaman Alarm & Event Log (Frontend)
- [x] Komponen tabel untuk menampilkan Alarm dan Event Log.
- [x] Implementasi fitur pencarian cepat.
- [~] Filter UI (Customer, Site, Jenis Perangkat, Status, Rentang Waktu).
- [x] Integrasi tombol export (XLSX, CSV, PDF).
- [x] UI untuk menambahkan catatan pemulihan pada alarm yang sudah selesai.

### 3.4 Halaman History Monitoring (Frontend)
- [x] Tampilkan statistik KPI: Uptime, Downtime, Availability, Rata-rata Response Time.
- [x] Integrasi pustaka charting (Recharts/Chart.js) untuk grafik latensi.
- [~] Tampilkan timeline kejadian (Gantt-like chart).

### 3.5 User Management (Frontend - Admin only)
- [x] UI untuk melihat daftar user.
- [x] UI untuk menambah/mengedit/menghapus user.
- [x] UI untuk mengubah peran (role) user.

### 3.6 Real-time Update (Frontend)
- [x] Konfigurasi klien WebSocket untuk terhubung ke backend.
- [x] Gunakan Context API / Zustand / Redux untuk menyimpan dan memperbarui status Node secara real-time.
- [x] Update UI secara otomatis saat ada perubahan status Node atau Alarm dari WebSocket.

---

## Fase 4: Pengujian & Deployment

### 4.1 Pengujian
- [ ] **Unit Tests:**
    - [ ] Frontend: Komponen React, hooks, reducer/store.
    - [ ] Backend: Service, controller, utilitas monitoring.
- [ ] **Integration Tests:**
    - [ ] Backend: Endpoint API (CRUD, autentikasi, filter).
    - [ ] Integrasi Monitoring Engine & Database.
    - [ ] Integrasi WebSocket antara backend dan frontend (mock).
- [ ] **End-to-End (E2E) Tests:**
    - [ ] Alur login user.
    - [ ] Interaksi Topology Editor (drag-drop, edit, simpan).
    - [ ] Verifikasi perubahan status Node secara real-time di UI.
    - [ ] Proses pembuatan dan resolusi alarm.
    - [ ] Fungsi export dan import data.
- [ ] **Performance Testing:**
    - [ ] Uji performa API dan WebSocket di bawah beban (simulasi banyak Node).
    - [ ] Uji responsivitas UI.
- [ ] **User Acceptance Testing (UAT):**
    - [ ] Verifikasi semua fitur sesuai PRD oleh user perwakilan (Admin, Operator, Viewer).

### 4.2 Dokumentasi
- [ ] Perbarui `README.md` (cara setup, dev, build, run).
- [ ] Dokumentasi API (OpenAPI/Swagger).
- [ ] Dokumentasi Teknis (arsitektur, alur data).

### 4.3 Deployment
- [ ] Build image Docker untuk frontend dan backend.
- [ ] Buat skrip deployment (misal: Docker Compose untuk produksi, Kubernetes manifests dasar).
- [ ] Konfigurasi variabel lingkungan untuk produksi (database, JWT secret, dll.).
