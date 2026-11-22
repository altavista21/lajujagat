import { NextResponse } from "next/server";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type XenditInvoice = {
  id: string;
  invoice_url: string;
  expiry_date?: string;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ bookingCode: string }> }
) {
  const { bookingCode } = await context.params;
  const secretKey = process.env.XENDIT_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!secretKey || !appUrl) {
    return NextResponse.json({ message: "Pembayaran belum dikonfigurasi oleh pengelola." }, { status: 503 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    include: {
      trip: { include: { route: true } },
      passengers: true,
      payments: { where: { status: PaymentStatus.PENDING }, orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!booking || booking.status !== BookingStatus.PENDING_PAYMENT || booking.expiresAt <= new Date()) {
    return NextResponse.json({ message: "Booking tidak ditemukan atau masa pemesanannya sudah berakhir." }, { status: 409 });
  }

  const existing = booking.payments[0];
  if (existing?.checkoutUrl) {
    return NextResponse.json({ checkoutUrl: existing.checkoutUrl, paymentId: existing.id });
  }
  if (existing) {
    return NextResponse.json({ message: "Tagihan sedang dibuat. Coba kembali sebentar lagi." }, { status: 409 });
  }

  const amount = booking.trip.price * booking.passengers.length;
  const remainingSeconds = Math.floor((booking.expiresAt.getTime() - Date.now()) / 1000);
  if (remainingSeconds < 60) {
    return NextResponse.json({ message: "Waktu pemesanan hampir habis. Silakan ulangi pemilihan kursi." }, { status: 409 });
  }

  const payment = await prisma.payment.create({
    data: { bookingId: booking.id, provider: "XENDIT", amount, status: PaymentStatus.PENDING }
  });

  try {
    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        external_id: booking.bookingCode,
        amount,
        currency: "IDR",
        description: `Travel Laju Jagat ${booking.trip.route.origin} - ${booking.trip.route.destination}`,
        payer_email: booking.customerEmail || undefined,
        invoice_duration: Math.min(remainingSeconds, 86400),
        success_redirect_url: `${appUrl}/tiket/${encodeURIComponent(booking.bookingCode)}`,
        failure_redirect_url: `${appUrl}/pesanan/${encodeURIComponent(booking.bookingCode)}?payment=failed`
      }),
      cache: "no-store"
    });

    const invoice = await response.json() as XenditInvoice & { message?: string };
    if (!response.ok || !invoice.id || !invoice.invoice_url) {
      throw new Error("Xendit gagal membuat invoice.");
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: invoice.id, checkoutUrl: invoice.invoice_url }
    });

    return NextResponse.json({ checkoutUrl: invoice.invoice_url, paymentId: payment.id }, { status: 201 });
  } catch (error) {
    console.error("Xendit invoice creation failed", error);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED }
    });
    return NextResponse.json({ message: "Tagihan belum berhasil dibuat. Silakan coba lagi." }, { status: 502 });
  }
}
