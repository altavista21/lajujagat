import { notFound } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dateTime = (value: Date) => value.toLocaleString("id-ID", {
  dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta"
});

export default async function TicketPage({
  params
}: {
  params: Promise<{ bookingCode: string }>;
}) {
  const { bookingCode } = await params;
  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    include: {
      trip: { include: { route: true, vehicle: true } },
      passengers: { include: { tripSeat: true } },
      payments: { where: { status: "PAID" }, take: 1 }
    }
  });

  if (!booking) notFound();
  const confirmed = booking.status === BookingStatus.CONFIRMED && booking.payments.length > 0;

  return <main style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: "Arial, sans-serif", color: "#17211d" }}>
    <a href="/" style={{ color: "#176b4a" }}>← Travel Laju Jagat</a>
    <section style={{ marginTop: 24, padding: 24, border: "1px solid #dce5df", borderRadius: 18 }}>
      <p style={{ color: "#176b4a", fontWeight: 700 }}>TRAVEL LAJU JAGAT</p>
      <h1 style={{ marginBottom: 8 }}>{confirmed ? "E-Ticket Perjalanan" : "Status Pemesanan"}</h1>
      <p style={{ color: confirmed ? "#176b4a" : "#9a6412", fontWeight: 700 }}>
        {confirmed ? "PEMBAYARAN TERVERIFIKASI · TIKET TERKONFIRMASI" : `STATUS: ${booking.status}`}
      </p>
      <h2 style={{ letterSpacing: 2 }}>{booking.bookingCode}</h2>
      <hr style={{ border: 0, borderTop: "1px solid #dce5df", margin: "20px 0" }}/>
      <h3>{booking.trip.route.origin} → {booking.trip.route.destination}</h3>
      <p>Berangkat: {dateTime(booking.trip.departureAt)}</p>
      <p>Perkiraan tiba: {dateTime(booking.trip.arrivalAt)}</p>
      <p>Armada: {booking.trip.vehicle.name}</p>
      <p>Pemesan: {booking.customerName}</p>
      <h3>Penumpang dan kursi</h3>
      {booking.passengers.map((passenger) => <p key={passenger.id}>{passenger.name} · Kursi {passenger.tripSeat.seatNo}</p>)}
      <hr style={{ border: 0, borderTop: "1px solid #dce5df", margin: "20px 0" }}/>
      <p>Total: <b>Rp{(booking.trip.price * booking.passengers.length).toLocaleString("id-ID")}</b></p>
      {confirmed
        ? <p style={{ color: "#176b4a" }}>Simpan halaman ini sebagai bukti perjalanan. Tunjukkan kode booking kepada petugas.</p>
        : <p>Pemesanan belum menjadi tiket. Tiket diterbitkan setelah Xendit mengonfirmasi pembayaran melalui webhook.</p>}
      <p>Untuk menyimpan tiket, gunakan menu Cetak pada browser dan pilih Simpan sebagai PDF.</p>
    </section>
  </main>;
}
