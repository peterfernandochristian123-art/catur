# Catur Sekolah - Arena Catur & Leaderboard Antar-Kelas ♟️🏫

Aplikasi web permainan catur modern yang dirancang khusus untuk ekosistem sekolah (lab komputer, smartphone siswa, dan server intranet sekolah). Dilengkapi dengan mode **Player vs Player (Lokal & Ruang PIN)**, **Bot AI Berjenjang**, **Latihan Taktik & Puzzle Harian**, serta **Leaderboard Real-Time Antar-Siswa dan Antar-Kelas**.

---

## 🌟 Fitur Utama

### 1. 🎮 Mode Permainan
- **Bot AI Sekolah (Minimax + Positional Evaluation):**
  - **Level 1 (Pemula):** Bot kasual untuk pemula (±800 ELO).
  - **Level 2 (Ekskul):** Bot taktis menengah dengan kedalaman kalkulasi 2 langkah (±1400 ELO).
  - **Level 3 (Master):** Bot cerdas berstandar pembina/master sekolah dengan pemangkasan Alpha-Beta dan tabel posisi (±1900 ELO).
- **PvP Ruang PIN (Online Jarak Jauh & Jaringan Lokal):**
  - **Mode Internet Jarak Jauh (WebRTC P2P):** Tanding antar-kota, beda WiFi, atau pakai paket data HP tanpa server dan tanpa konfigurasi khusus. Cukup bagikan PIN atau klik *Salin Link Tanding*.
  - **Mode WiFi / Lab Lokal (LAN):** Tanding antar komputer lab atau ponsel yang terhubung ke WiFi sekolah yang sama.
- **Jam Catur Digital (Chess Clock):**
  - **Blitz 3 Menit:** Cocok untuk pertandingan cepat saat jam istirahat sekolah.
  - **Rapid 10 Menit:** Untuk kompetisi formal ekskul.
  - **Mode Tanpa Batas:** Untuk santai dan belajar.

### 2. 🧩 Latihan & Teka-Teki Catur
- Koleksi puzzle taktis terkurasi (Skakmat 1 langkah, *Back-Rank Mate*, *Knight Fork*, *Smothered Mate*, dan *Pin Tactic*).
- Validasi solusi otomatis, tombol petunjuk (*Hint*), dan penjelasan strategi edukatif.

### 3. 🏆 Leaderboard & Profil Siswa
- **Peringkat Siswa:** Peringkat ELO, rekor menang/seri/kalah, dan *win streak*.
- **Peringkat Antar-Kelas:** Akumulasi poin kemenangan untuk menghidupkan kebanggaan dan sportivitas kelas (misal: X-A vs XI-MIPA-1).
- **Profil Siswa:** Kustomisasi nama, kelas, dan avatar bidak favorit.

### 4. 🎨 Desain & Audio
- **Audio Synthesizer (Web Audio API):** Efek suara ketukan kayu, tangkapan bidak, lonceng skak, dan arpeggio kemenangan tanpa perlu download file MP3 eksternal.
- **Tema Papan:** Ganti tampilan secara instan (*Classic Wood Walnut*, *Dark Tournament Emerald*, *Cyberpunk Neon*, dan *Chalkboard*).
- **Indikator Langkah Visual:** Titik hijau untuk langkah legal, lingkaran merah untuk target tangkapan, dan highlight merah berdenyut saat Raja dalam kondisi skak.

---

## 🚀 Cara Menjalankan

Aplikasi ini dapat dijalankan langsung di browser apa pun tanpa memerlukan build tools yang rumit:

### Opsi 1: Menjalankan dengan Node.js (Rekomendasi)
```bash
node server.js
```
Buka browser dan akses: `http://localhost:3000`

### Opsi 2: Buka Langsung File HTML
Buka file `index.html` langsung dengan klik dua kali di browser (Google Chrome, Edge, Firefox, dsb.).

---

## ☁️ Integrasi Firebase (Opsional)
Aplikasi memiliki arsitektur *offline-resilient* yang secara otomatis menggunakan **LocalStorage** jika Firebase belum dikonfigurasikan.

Untuk menghubungkan dengan proyek Firebase sekolah Anda:
1. Buat proyek di [Firebase Console](https://console.firebase.google.com).
2. Aktifkan **Cloud Firestore** dan **Authentication**.
3. Masukkan konfigurasi JSON Firebase ke dalam modal konfigurasi di aplikasi.

---

## 📁 Struktur File
```
catur/
├── index.html                 # Struktur semantik antarmuka web
├── server.js                  # Server lokal Node.js port 3000
├── css/
│   └── style.css              # Glassmorphism design system & tema catur
├── js/
│   ├── audio.js               # Web Audio API sound generator
│   ├── chess-engine.js        # Engine aturan FIDE catur lengkap (pure JS)
│   ├── ai-bot.js              # Algoritma Minimax & Alpha-Beta Bot AI
│   ├── puzzles.js             # Koleksi taktik & puzzle catur sekolah
│   ├── firebase-service.js    # Layanan akun, leaderboard, & sinkronisasi PIN
│   └── app.js                 # Controller UI & interaksi utama
└── brainstorming-session-2026-11-01.md # Dokumen sesi brainstorming
```
