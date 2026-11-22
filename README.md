# Travel Laju Jagat

Aplikasi web shuttle antar-kota menggunakan Next.js App Router, TypeScript, Prisma, dan PostgreSQL.

## Menjalankan lokal

1. Gunakan Node.js 20 atau lebih baru.
2. Salin `.env.example` menjadi `.env` dan isi `DATABASE_URL` dari database PostgreSQL milik Anda.
3. Jalankan:

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

## Konfigurasi yang masih diperlukan

- PostgreSQL aktif dan `DATABASE_URL` yang benar.
- Data master rute, armada, jadwal, trip, dan kursi. API pencarian hanya membaca data yang sudah dimasukkan.
- Integrasi pembayaran dan callback terverifikasi sebelum booking dapat dinyatakan lunas.
- Autentikasi dan otorisasi admin/dispatcher/sopir.
- Pengujian build, migrasi, dan concurrency terhadap database staging sebelum produksi.

## Status

Antarmuka pencarian jadwal, pemilihan kursi, data pemesan, dan penguncian kursi 15 menit sudah dihubungkan ke endpoint backend. Pencarian membaca PostgreSQL, bukan data demonstrasi. Aplikasi belum dapat menampilkan jadwal sampai database diisi dengan data rute, kendaraan, template jadwal, trip, dan kursi. Belum ada integrasi pembayaran, callback pembayaran, autentikasi admin/dispatcher/sopir, maupun E-Ticket produksi. Pengujian build, migrasi, dan concurrency belum dijalankan. Jangan gunakan untuk menerima pembayaran atau pemesanan nyata sebelum konfigurasi dan pengujian tersebut selesai.
