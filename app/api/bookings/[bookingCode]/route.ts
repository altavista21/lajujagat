import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingCode: string }> }
) {
  const { bookingCode } = await context.params;
  const booking = await prisma.booking.findUnique({
    where: { bookingCode },
    select: {
      bookingCode: true, customerName: true, customerPhone: true, status: true,
      expiresAt: true, createdAt: true,
      trip: {
        select: {
          departureAt: true, arrivalAt: true, price: true,
          route: { select: { origin: true, destination: true } },
          vehicle: { select: { name: true } }
        }
      },
      passengers: {
        select: { name: true, tripSeat: { select: { seatNo: true } } }
      },
      payments: {
        where: { status: "PAID" },
        select: { amount: true, paidAt: true },
        take: 1
      }
    }
  });

  if (!booking) return NextResponse.json({ message: "Booking tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ booking });
}
