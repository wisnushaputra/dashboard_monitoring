# Product Requirement Document (PRD)
## Web-Based Corporate Customer Monitoring Dashboard (NOC Dashboard)

---

### 1. Ringkasan Eksekutif & Visi Produk
Aplikasi **Dashboard Monitoring Customer Corporate** dirancang sebagai sistem Network Operation Center (NOC) yang modern, minimalis, dan berkinerja tinggi untuk memantau konektivitas pelanggan korporat secara real-time. Fokus utama produk ini adalah kesederhanaan visual, kemudahan penggunaan, dan keandalan data.

Salah satu fitur unggulan adalah **Topology Editor** interaktif (terinspirasi dari *The Dude*) yang memungkinkan administrator dan operator mendesain serta memetakan topologi jaringan pelanggan secara visual menggunakan mekanisme drag-and-drop.

---

### 2. Manajemen Pengguna & Peran (RBAC)
Sistem mendukung autentikasi berbasis token (JWT) dengan Role-Based Access Control (RBAC) yang terbagi menjadi tiga peran:

| Peran | Deskripsi | Hak Akses |
|---|---|---|
| **Viewer** | Memantau dashboard, melihat log, dan status jaringan secara real-time. | Hanya baca (Read-only) pada seluruh halaman, tidak bisa mengubah topologi atau konfigurasi. |
| **Operator** | Mengelola operasional harian, merespons alarm, dan memasukkan catatan pemulihan. | Hak akses Viewer + mengontrol alarm suara, menambahkan catatan insiden, melakukan ekspor data. |
| **Admin** | Memiliki kontrol penuh atas sistem dan konfigurasi. | Hak akses Operator + Topology Editor (menambah/mengedit/menghapus node, merelasikan perangkat), impor data, dan manajemen user. |

---

### 3. Fitur Utama & Spesifikasi Fungsional

#### 3.1. Dashboard Utama (Overview)
Tampilan dashboard berkonsep minimalis dengan tata letak sidebar navigasi dan topbar statis.
- **Ringkasan Metrik Utama (Cards):**
  - Total Site (Keseluruhan lokasi customer).
  - Node Online (Perangkat berstatus Hijau/Up).
  - Node Offline (Perangkat berstatus Merah/Down).
  - Total Alarm Aktif (Perangkat dengan status gangguan belum pulih).
- **Recent Events Widget:** Daftar kejadian/gangguan terbaru secara real-time.
- **Auto Refresh & Dark Mode Toggle:** Pengaturan interval refresh UI dan pergantian tema visual (Gelap/Terang).

#### 3.2. Topology Editor (Inspirasi *The Dude*)
Fitur visualisasi jaringan berbasis kanvas interaktif menggunakan drag-and-drop.
- **Kanvas Topologi:**
  - Drag-and-drop node baru dari palet perangkat ke kanvas.
  - Membuat garis penghubung (koneksi) antar node secara interaktif.
  - Mengubah posisi, ukuran, warna, dan label node langsung di kanvas.
  - Zoom-in, zoom-out, dan panning pada kanvas.
- **Tipe Perangkat (Nodes):** Router, Switch, Firewall, Server, OLT, Access Point, dll.
- **Konfigurasi Node (Double-Click Modal):**
  - Nama Node, IP Address (IPv4/IPv6).
  - Jenis Perangkat, Lokasi Fisik, Deskripsi.
  - Interval Monitoring (misalnya: 10 detik, 30 detik, 60 detik).
- **Garis Penghubung (Links):** Mewakili kabel atau link nirkabel. Warna garis dapat merepresentasikan status utilisasi atau link state (Up/Down).

#### 3.3. Sistem Monitoring Real-Time & Engine ICMP
- **Engine ICMP Ping:** Backend secara independen melakukan ping ke IP tujuan sesuai interval masing-masing node.
- **Status Node Real-Time:**
  - **Hijau (Up):** Respon ping sukses, latensi di bawah ambang batas (misal < 100ms).
  - **Kuning (Warning / High Latency):** Respon sukses tetapi latensi tinggi (misal > 100ms) atau terjadi packet loss parsial.
  - **Merah (Down):** Respon ping gagal berurutan dalam batas toleransi (misal 3x berturut-turut).
- **Alarm Visual & Audio:**
  - Node berstatus **Down** akan berkedip merah secara visual di Topology Editor.
  - Sistem mengeluarkan suara alarm (beeping alert) yang dapat diaktifkan/dimatikan melalui tombol toggle di topbar/sidebar.
- **Alur Pencatatan Kejadian:**
  - Saat Down: Catat waktu mulai gangguan (Down Time) dan buat entri alarm baru.
  - Saat Recovery (Up kembali): Catat waktu pulih (Up Time), hitung durasi gangguan otomatis, simpan status, dan berikan opsi pengisian catatan pemulihan (misal: "Penyebab: Listrik padam di sisi pelanggan").

#### 3.4. Alarm & Event Log
Halaman khusus yang menampilkan riwayat lengkap insiden jaringan.
- **Pencarian & Filter:**
  - Pencarian cepat berdasarkan Nama Node atau IP.
  - Filter berdasarkan Customer, Site, Jenis Perangkat, Status (Active/Resolved), dan Rentang Waktu kejadian.
- **Tabel Event Log:** Menampilkan kolom Customer/Site, Node, IP, Status (Up/Down), Waktu Mulai, Waktu Selesai, Durasi, dan Catatan Tindakan.

#### 3.5. History Monitoring & Statistik
Halaman analisis performa jaringan jangka panjang.
- **Statistik Key Performance Indicator (KPI):**
  - Uptime & Downtime harian/mingguan/bulanan.
  - Persentase Availability (%) per site/node.
  - Response time (latensi) rata-rata.
- **Visualisasi Grafik:**
  - Grafik tren latensi (Line chart).
  - Timeline kejadian interaktif (Gantt-like chart untuk down-time).

#### 3.6. Ekspor & Impor Data
- **Ekspor Data:** Dukungan ekspor laporan instan untuk Event Log, Alarm History, dan Statistik Monitoring ke format:
  - Microsoft Excel (.xlsx) - dengan pemformatan warna status yang rapi.
  - CSV (.csv) - untuk pemrosesan data mentah.
  - PDF (.pdf) - format laporan formal berlogo perusahaan untuk kebutuhan pelaporan ke manajemen/pelanggan.
- **Impor Data Node:** Memungkinkan admin melakukan impor bulk data node baru menggunakan template spreadsheet (Excel/CSV), berisi kolom: `Nama_Node`, `IP_Address`, `Tipe_Perangkat`, `Lokasi`, `Interval_Detik`, `Deskripsi`.

---

### 4. Arsitektur Modular & Ekstensi di Masa Depan
Backend dirancang menggunakan pola strategi (Strategy Pattern) atau adapter arsitektur untuk mempermudah penambahan metode monitoring baru tanpa mengganggu core engine:

```
                  +-----------------------+
                  |    Monitoring Core    |
                  +-----------+-----------+
                              |
            +-----------------+-----------------+
            |                 |                 |
    +-------v-------+ +-------v-------+ +-------v-------+
    |  ICMP Engine  | |  SNMP Engine  | |  HTTP Engine  |
    | (Aktif Skg)   | | (Masa Depan)  | | (Masa Depan)  |
    +---------------+ +---------------+ +---------------+
```

Struktur database dirancang modular dengan kolom generik `monitor_type` (misal: "ICMP", "SNMP_PORT", "HTTP_GET") dan kolom `monitor_config` berformat JSON untuk menyimpan konfigurasi spesifik metode tersebut.

---

### 5. Kebutuhan Non-Fungsional (NFR)
1. **Performa Tinggi:** Latensi pembaruan status dari backend ke UI harus di bawah 1 detik menggunakan WebSockets.
2. **Skalabilitas:** Monitoring engine harus mampu memproses hingga 1000 pings per menit secara asinkron tanpa membebani thread utama server (menggunakan Worker Threads atau asinkron I/O).
3. **Keamanan:** Penyimpanan password pengguna menggunakan hashing bcrypt/argon2. Proteksi dari XSS, CSRF, dan SQL Injection.
4. **Responsivitas UI:** Tampilan harus sepenuhnya responsif (Desktop, Tablet, dan Mobile minimal pada bagian ringkasan dashboard).

---

### 6. Desain Visual (Aesthetics)
- **Tema:** Modern, Minimalis, dan Bersih (Clean NOC Look).
- **Warna:** Dominan warna netral (Slate/Zinc untuk latar belakang dan teks), dengan warna aksen tegas (Hijau Emerald untuk OK, Merah Crimson untuk Critical, Kuning Amber untuk Warning).
- **Tipografi:** Sans-serif modern (seperti Inter atau Geist) untuk keterbacaan tinggi pada teks angka IP Address dan metrik.
- **Interaksi Kanvas:** Garis penghubung yang luwes (curved links) dan efek berkedip (pulsing red glow) pada node yang offline untuk menarik perhatian operator NOC dengan cepat.
