# Travel Laju Jagat

Starter aplikasi web pemesanan shuttle antar-kota berbasis Next.js App Router dan TypeScript.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Status implementasi

Versi awal ini berisi antarmuka pencarian jadwal dan pemilihan kursi interaktif dengan data demonstrasi yang diberi penanda. Belum terhubung ke database atau pembayaran, dan belum boleh digunakan untuk menerima pemesanan nyata.

Tahap berikutnya: PostgreSQL/Prisma, inventaris trip, transaksi seat-lock 15 menit dengan validasi konkurensi, checkout, serta dashboard operasional.
