import { randomBytes } from "node:crypto";
import { Prisma, SeatStatus, TripStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PassengerInput = { seatNo: string; name: string };
type LockInput = {
  tripId: string;
  seatNos: string[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  passengers: PassengerInput[];
};

function validInput(value: unknown): value is LockInput {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (typeof data.tripId !== "string" || !data.tripId.trim()) return false;
  if (typeof data.customerName !== "string" || data.customerName.trim().length < 2) return false;
  if (typeof data.customerPhone !== "string" || !/^\+?[0-9]{9,15}$/.test(data.customerPhone.trim())) return false;
  if (data.customerEmail !== undefined && data.customerEmail !== "" &&
      (typeof data.customerEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail))) return false;
  if (!Array.isArray(data.seatNos) || data.seatNos.length < 1 || data.seatNos.length > 16 ||
      data.seatNos.some((seat) => typeof seat !== "string" || !seat.trim())) return false;
  if (new Set(data.seatNos).size !== data.seatNos.length) return false;
  if (!Array.isArray(data.passengers) || data.passengers.length !== data.seatNos.length) return false;
  const passengers = data.passengers as PassengerInput[];
  if (passengers.some((p) => !p || typeof p.seatNo !== "string" ||
      typeof p.name !== "string" || p.name.trim().length < 2)) return false;
  return new Set(passengers.map((p) => p.seatNo)).size === passengers.length &&
    passengers.every((p) => (data.seatNos as string[]).includes(p.seatNo));
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!validInput(body)) {
    return NextResponse.json({
      message: "Periksa data pemesan, nomor WhatsApp, kursi, dan nama setiap penumpang."
    }, { status: 400 });
  }

  const data = body;
  const seatNos = [...data.seatNos].sort();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60_000);
  const bookingCode = `LJ-${randomBytes(5).toString("hex").toUpperCase()}`;
  const lockToken = randomBytes(32).toString("hex");

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: data.tripId },
        select: { id: true, status: true, departureAt: true, price: true }
      });
      if (!trip || trip.status !== TripStatus.SCHEDULED || trip.departureAt <= now) {
        throw new Error("TRIP_UNAVAILABLE");
      }

      await tx.tripSeat.updateMany({
        where: {
          tripId: trip.id,
          status: SeatStatus.LOCKED,
          lockedUntil: { lte: now }
        },
        data: { status: SeatStatus.AVAILABLE, lockToken: null, lockedUntil: null }
      });

      for (const seatNo of seatNos) {
        const result = await tx.tripSeat.updateMany({
          where: { tripId: trip.id, seatNo, status: SeatStatus.AVAILABLE },
          data: { status: SeatStatus.LOCKED, lockToken, lockedUntil: expiresAt }
        });
        if (result.count !== 1) throw new Error(`SEAT_UNAVAILABLE:${seatNo}`);
      }

      const created = await tx.booking.create({
        data: {
          bookingCode,
          tripId: trip.id,
          customerName: data.customerName.trim(),
          customerPhone: data.customerPhone.trim(),
          customerEmail: data.customerEmail || null,
          expiresAt
        }
      });

      const seatRows = await tx.tripSeat.findMany({
        where: { tripId: trip.id, seatNo: { in: seatNos } },
        select: { id: true, seatNo: true }
      });
      const seatIdByNo = new Map(seatRows.map((seat) => [seat.seatNo, seat.id]));

      await tx.bookingPassenger.createMany({
        data: data.passengers.map((passenger) => ({
          bookingId: created.id,
          tripSeatId: seatIdByNo.get(passenger.seatNo)!,
          name: passenger.name.trim()
        }))
      });

      return {
        id: created.id,
        bookingCode: created.bookingCode,
        expiresAt: created.expiresAt,
        amount: trip.price * seatNos.length,
        passengers: data.passengers.map((p) => ({ name: p.name.trim(), seatNo: p.seatNo }))
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });

    return NextResponse.json({
      message: "Kursi berhasil dikunci selama 15 menit.",
      booking
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SEAT_UNAVAILABLE:")) {
      const seatNo = error.message.split(":")[1];
      return NextResponse.json({
        message: `Maaf, kursi nomor ${seatNo} baru saja dipesan penumpang lain. Silakan pilih kursi lain yang tersedia.`
      }, { status: 409 });
    }
    if (error instanceof Error && error.message === "TRIP_UNAVAILABLE") {
      return NextResponse.json({ message: "Jadwal ini sudah tidak tersedia. Silakan pilih perjalanan lain." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ message: "Pemesanan sedang ramai. Silakan coba kembali." }, { status: 409 });
    }
    console.error("Seat lock failed", error);
    return NextResponse.json({ message: "Terjadi gangguan saat memproses pemesanan. Silakan coba kembali." }, { status: 500 });
  }
}
