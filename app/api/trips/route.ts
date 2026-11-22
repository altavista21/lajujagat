import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SeatStatus, TripStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.searchParams.get("origin")?.trim();
  const destination = url.searchParams.get("destination")?.trim();
  const date = url.searchParams.get("date");
  const passengers = Number(url.searchParams.get("passengers") ?? "1");

  if (!origin || !destination || origin === destination || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ||
      !Number.isInteger(passengers) || passengers < 1 || passengers > 16) {
    return NextResponse.json({ message: "Isi kota asal, tujuan, tanggal, dan jumlah penumpang dengan benar." }, { status: 400 });
  }

  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ message: "Tanggal keberangkatan tidak valid." }, { status: 400 });
  }

  const trips = await prisma.trip.findMany({
    where: {
      status: TripStatus.SCHEDULED,
      departureAt: { gte: start, lt: end },
      route: { origin, destination, active: true }
    },
    include: {
      route: { select: { origin: true, destination: true } },
      vehicle: { select: { name: true, template: { select: { name: true, capacity: true } } } },
      seats: { select: { seatNo: true, status: true, lockedUntil: true } }
    },
    orderBy: { departureAt: "asc" }
  });

  const now = new Date();
  const result = trips.map((trip) => {
    const availableSeats = trip.seats.filter((seat) =>
      seat.status === SeatStatus.AVAILABLE ||
      (seat.status === SeatStatus.LOCKED && seat.lockedUntil && seat.lockedUntil <= now)
    ).length;
    return {
      id: trip.id,
      origin: trip.route.origin,
      destination: trip.route.destination,
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      price: trip.price,
      vehicle: trip.vehicle.name || trip.vehicle.template.name,
      capacity: trip.vehicle.template.capacity,
      availableSeats,
      seats: trip.seats.map((seat) => ({
        seatNo: seat.seatNo,
        status: seat.status === SeatStatus.LOCKED && seat.lockedUntil && seat.lockedUntil <= now
          ? SeatStatus.AVAILABLE : seat.status
      }))
    };
  }).filter((trip) => trip.availableSeats >= passengers);

  return NextResponse.json({ trips: result });
}
