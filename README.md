# Q-Shield — Frontend

Simulasi aplikasi e-wallet ("Dompetku") dengan Q-Shield sebagai lapisan
verifikasi. Q-Shield di sini diposisikan sebagai SDK di dalam aplikasi
pembayaran, bukan aplikasi tersendiri.

Ada dua halaman:

| Route | Isi |
|---|---|
| `/` | Aplikasi e-wallet "Dompetku" — kamera untuk scan QRIS, panel demo tanpa kamera, dan hasil verifikasi Q-Shield |
| `/merchant` | Stiker QRIS yang bisa discan (bukan simulator, gambar QR beneran) — buat ditampilkan di layar/device lain saat demo |

## Prasyarat

- Node.js (untuk frontend ini)
- Backend Q-Shield (folder `hackathon-telkom-Q-Shield`) sudah jalan — lihat README di folder itu

## 1. Jalankan backend dulu

```bash
cd ../hackathon-telkom-Q-Shield
source .venv/bin/activate          # kalau venv belum dibuat: python -m venv .venv && pip install -e .
python scripts/seed.py             # isi data demo (histori merchant)
uvicorn qshield.api:app --reload --host 0.0.0.0 --port 8000
```

Cek hidup: buka http://localhost:8000/api/v1/health

## 2. Jalankan frontend

```bash
npm install
npm run dev
```

Buka http://localhost:3000

Secara default frontend memanggil backend di `http://localhost:8000`
(lihat `next.config.ts`). Kalau backend jalan di alamat lain, buat file
`.env.local` di folder ini:

```
NEXT_PUBLIC_API=http://localhost:8000
```

`.env.local` tidak ikut ke-commit (sudah di `.gitignore`) — aman dipakai
untuk URL yang sering berubah.

**Penting:** kalau kamu edit `.env.local` atau `next.config.ts`, restart
`npm run dev` — Next.js hanya membaca keduanya saat server start, tidak
hot-reload.

## Panel demo (tanpa kamera)

Tombol roda gigi ⚙ di kanan atas halaman `/` membuka panel yang
menjalankan tiga skenario tanpa kamera, plus input manual untuk payload
dan koordinat. Ada juga tombol "Kunci di titik ini" untuk mengunci GPS
kalau sinyal di dalam ruangan tidak stabil.

Ini bukan sekadar alat bantu pengembangan — saat merekam video, izin
kamera atau sinyal GPS bisa gagal pada saat yang paling tidak tepat.
Panel ini memastikan demo tetap dapat dijalankan.

## Halaman `/merchant`

Menampilkan stiker QRIS asli (QR code beneran, digambar pakai library
`qrcode`). Buka halaman ini di device/tab lain, lalu arahkan kamera dari
halaman `/` ke situ untuk scan sungguhan.

- **Spasi** — tukar antara QR asli dan QR palsu
- **L** — tampilkan/sembunyikan label (buat cek pas rekam, sembunyikan buat demo live)

## Menguji dari HP (lewat internet, bukan cuma WiFi lokal)

Kamera dan GPS di browser **memerlukan HTTPS** — kecuali di `localhost`.
Ini artinya HP tidak bisa langsung buka `http://192.168.x.x:3000` dan
memakai kamera. Cara tercepat pakai [ngrok](https://ngrok.com).

### Kamu butuh DUA tunnel ngrok terpisah — satu untuk frontend, satu untuk backend

Ini bagian yang paling sering salah: frontend dan backend adalah dua
server berbeda (port 3000 dan port 8000), jadi masing-masing butuh
tunnel-nya sendiri. Kalau cuma satu tunnel dipakai untuk keduanya, HP
bisa buka halamannya tapi verifikasi akan gagal dengan pesan
*"Tidak dapat menghubungi ... pastikan backend berjalan"* — karena
frontend jadi memanggil dirinya sendiri, bukan backend.

**Terminal 1 — tunnel untuk frontend:**
```bash
ngrok http 3000
```
Catat URL-nya, mis. `https://abcd-1234.ngrok-free.app`.

**Terminal 2 — tunnel untuk backend:**
```bash
ngrok http 8000
```
Catat URL-nya juga (beda dari yang di atas), mis. `https://wxyz-5678.ngrok-free.app`.

**Lalu, dua konfigurasi yang perlu diisi manual:**

1. `.env.local` — arahkan ke tunnel **backend**:
   ```
   NEXT_PUBLIC_API=https://wxyz-5678.ngrok-free.app
   ```

2. `next.config.ts` — izinkan tunnel **frontend** mengakses dev server
   (Next.js dev mode memblokir cross-origin request secara default):
   ```ts
   const nextConfig: NextConfig = {
     env: {
       NEXT_PUBLIC_API: process.env.NEXT_PUBLIC_API || "http://localhost:8000",
     },
     allowedDevOrigins: ["abcd-1234.ngrok-free.app"], // host tunnel frontend, tanpa https://
   };
   ```

3. Restart `npm run dev` supaya kedua perubahan kebaca.

4. Buka URL tunnel **frontend** (`https://abcd-1234.ngrok-free.app`) di HP.

URL ngrok gratis berubah setiap kali tunnel di-restart, jadi dua langkah
di atas (`.env.local` dan `allowedDevOrigins`) perlu diulang tiap kali
ganti URL.

Alternatif tanpa ngrok: deploy frontend ke Vercel dan backend ke
Railway/Render, lalu isi `NEXT_PUBLIC_API` dengan URL production
backend.

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman kosong / QR di `/merchant` tidak muncul | Package baru diinstall (`qrcode`, `html5-qrcode`) tapi dev server belum di-restart | Stop lalu jalankan ulang `npm run dev` |
| `Blocked cross-origin request to Next.js dev resource` di console | Host ngrok belum diizinkan | Tambahkan host-nya ke `allowedDevOrigins` di `next.config.ts`, restart dev server |
| "Tidak dapat menghubungi ... pastikan backend berjalan" | `NEXT_PUBLIC_API` menunjuk ke tunnel yang salah (tunnel frontend, bukan backend) atau backend belum jalan | Cek `NEXT_PUBLIC_API` di `.env.local` mengarah ke tunnel port 8000, dan pastikan `uvicorn` masih jalan |
| Kamera tidak bisa diakses | Diakses lewat `http://` selain `localhost` (mis. IP lokal) | Pakai `localhost`, atau tunnel HTTPS (ngrok) |

## Catatan tampilan

- PIN pad sengaja ditampilkan **di belakang** lembar hasil dan menjadi
  buram saat risiko terdeteksi. Ini menunjukkan secara visual bahwa
  intervensi terjadi sebelum PIN dimasukkan.
- Waktu pemeriksaan ditampilkan dalam milidetik agar terlihat bahwa
  keputusan benar-benar dihitung, bukan ditanam.
