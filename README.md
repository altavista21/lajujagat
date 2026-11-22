# Travel Laju Jagat

Aplikasi web shuttle antar-kota menggunakan Next.js App Router, TypeScript, Prisma, dan PostgreSQL.

## Menjalankan lokal

1. Gunakan Node.js 20 atau lebih baru.
2. Buat proyek PostgreSQL baru di Supabase, lalu salin `.env.example` menjadi `.env`.
3. Isi `DATABASE_URL` dengan connection string Supavisor Transaction Pooler (port 6543, tambahkan `pgbouncer=true`) dan `DIRECT_URL` dengan koneksi Direct (port 5432). Jika jaringan Anda tidak mendukung IPv6 Direct, gunakan Session Pooler untuk `DIRECT_URL`.
4. Jangan commit file `.env` atau memasukkan password database ke source code. Simpan variabel yang sama sebagai Environment Variables di Vercel.


5. Jalankan:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Buka `http://localhost:3000`.

## API backend

### Cari jadwal

`GET /api/trips?origin=Yogyakarta&destination=Semarang&date=2026-12-01&passengers=1`

Mengembalikan trip yang tersedia dari database dan inventaris kursi aktual. Format tanggal `YYYY-MM-DD`.

### Kunci kursi

`POST /api/bookings/lock`

Body JSON:

```json
{
  "tripId": "ID_TRIP_DATABASE",
  "seatNos": ["1", "2"],
  "customerName": "Nama Pemesan",
  "customerPhone": "081234567890",
  "customerEmail": "pemesan@example.com",
  "passengers": [
    { "seatNo": "1", "name": "Nama Penumpang 1" },
    { "seatNo": "2", "name": "Nama Penumpang 2" }
  ]
}
```

Kunci kursi dan pembuatan booking berjalan dalam transaksi PostgreSQL dengan isolasi serializable. Kursi dikunci 15 menit. Konflik kursi mengembalikan HTTP 409 dan seluruh transaksi dibatalkan. Kursi lock yang kedaluwarsa dilepas saat permintaan lock berikutnya untuk trip tersebut.

## Xendit

Alur pembayaran menggunakan Xendit Invoice API (hosted checkout):

1. Pelanggan mengunci kursi. Sistem membuat booking dengan batas waktu 15 menit.
2. Tombol Bayar dengan Xendit membuat invoice berdasarkan tarif perjalanan dan jumlah penumpang.
3. Pelanggan menyelesaikan pembayaran di halaman checkout Xendit.
4. Endpoint POST /api/webhooks/xendit memverifikasi header x-callback-token, ID invoice, kode booking, dan jumlah pembayaran.
5. Booking menjadi CONFIRMED dan kursi menjadi BOOKED setelah callback pembayaran terverifikasi. Halaman tiket tersedia di /tiket/[bookingCode].

Atur environment berikut di Vercel:
- XENDIT_SECRET_KEY: Secret API Key dari Test Mode saat pengembangan.
- XENDIT_CALLBACK_TOKEN: Callback Verification Token untuk webhook Invoice.
- NEXT_PUBLIC_APP_URL: URL publik aplikasi, tanpa trailing slash.
- ADMIN_PASSWORD: password admin unik.
- ADMIN_SESSION_SECRET: rahasia acak minimal 32 karakter.

Di Xendit Dashboard, pilih Test Mode, aktifkan metode pembayaran yang ingin diuji, lalu atur webhook Invoice ke https://DOMAIN-ANDA/api/webhooks/xendit. Jangan gunakan API key Live sebelum pengujian selesai. Jangan pernah menaruh secret key atau callback token di variabel NEXT_PUBLIC_, source code, atau GitHub.

## Dashboard admin

Buka /admin. Login memakai ADMIN_PASSWORD. Sesi admin menggunakan cookie HttpOnly bertanda tangan dan kedaluwarsa setelah 8 jam.

Dashboard menyediakan pembuatan rute, armada beserta kapasitas kursi, template jadwal, trip berdasarkan tanggal, serta ringkasan perjalanan, booking, dan pembayaran. Kursi trip dibuat otomatis dari kapasitas armada saat trip dibuat.

## Konfigurasi dan pekerjaan sebelum produksi

- Buat PostgreSQL aktif dan jalankan migrasi Prisma setelah schema diperbarui.
- Masukkan data rute, armada, tarif, dan jadwal asli perusahaan melalui dashboard. Data operasional nyata belum disediakan dan tidak dibuat-buat.
- Tambahkan rate limiting untuk login admin dan endpoint pembuatan invoice.
- Tambahkan rekonsiliasi dan prosedur refund untuk pembayaran terlambat setelah booking kedaluwarsa.
- Uji webhook Xendit Test Mode, invoice expired, callback duplikat, nominal tidak cocok, dan pembayaran bersamaan.
- Lengkapi pengelolaan edit/nonaktif, role petugas, laporan, dan audit log.
- Jalankan npm run build, migrasi, dan pengujian concurrency terhadap database staging sebelum produksi.

## Status

Pencarian jadwal, pemilihan kursi, penguncian kursi 15 menit, pembuatan invoice Xendit, callback terverifikasi, halaman E-Ticket, login admin, dan pembuatan data operasional dasar telah ditambahkan ke source code. Integrasi belum dapat dianggap siap transaksi sampai kredensial Xendit dan database dikonfigurasi, migrasi dijalankan, data operasional asli dimasukkan, serta build dan pengujian end-to-end dilakukan.