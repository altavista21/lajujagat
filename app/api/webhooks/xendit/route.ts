import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { BookingStatus, PaymentStatus, SeatStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type InvoiceCallback = {
  id?: string;
  external_id?: string;
  status?: string;
  amount?: number;
  paid_amount?: number;
  paid_at?: string;
};

function validToken(received: string | null, expected: string) {
  if (!received) return false;
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expectedToken = process.env.XENDIT_CALLBACK_TOKEN;
  if (!expectedToken || !validToken(request.headers.get("x-callback-token"), expectedToken)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as InvoiceCallback | null;
  if (!payload?.id || !payload.external_id || !payload.status) {
    return NextResponse.json({ message: "Invalid callback payload" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { provider: "XENDIT", providerRef: payload.id },
    include: { booking: { include: { passengers: { select: { tripSeatId: true } } } } }
  });

  if (!payment || payment.booking.bookingCode !== payload.external_id) {
    return NextResponse.json({ message: "Payment not found" }, { status: 404 });
  }

  if (payload.status === "PAID" || payload.status === "SETTLED") {
    const paidAmount = Number(payload.paid_amount ?? payload.amount);
    if (!Number.isFinite(paidAmount) || paidAmount !== payment.amount) {
      return NextResponse.json({ message: "Payment amount mismatch" }, { status: 422 });
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: payment.bookingId }, select: { status: true } });
      if (!current || current.status === BookingStatus.CANCELLED || current.status === BookingStatus.EXPIRED) return;

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, paidAt: payload.paid_at ? new Date(payload.paid_at) : new Date() }
      });
      if (current.status !== BookingStatus.CONFIRMED) {
        await tx.booking.update({ where: { id: payment.bookingId }, data: { status: BookingStatus.CONFIRMED } });
        await tx.tripSeat.updateMany({
          where: { id: { in: payment.booking.passengers.map((p) => p.tripSeatId) }, status: SeatStatus.LOCKED },
          data: { status: SeatStatus.BOOKED, lockToken: null, lockedUntil: null }
        });
      }
    });
    return NextResponse.json({ received: true });
  }

  if (payload.status === "EXPIRED") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.EXPIRED } });
      const result = await tx.booking.updateMany({
        where: { id: payment.bookingId, status: BookingStatus.PENDING_PAYMENT },
        data: { status: BookingStatus.EXPIRED }
      });
      if (result.count) {
        await tx.tripSeat.updateMany({
          where: { id: { in: payment.booking.passengers.map((p) => p.tripSeatId) }, status: SeatStatus.LOCKED },
          data: { status: SeatStatus.AVAILABLE, lockToken: null, lockedUntil: null }
        });
      }
    });
  }

  return NextResponse.json({ received: true });
}
