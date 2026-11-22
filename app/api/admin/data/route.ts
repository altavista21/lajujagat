import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

const fail = (message: string, status = 400) => NextResponse.json({ message }, { status });

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  const [routes, vehicles, vehicleTemplates, scheduleTemplates, trips, bookings, bookingCount, pendingPayments, paidPayments] = await Promise.all([
    prisma.route.findMany({ orderBy: { origin: "asc" } }),
    prisma.vehicle.findMany({ include: { template: true }, orderBy: { name: "asc" } }),
    prisma.vehicleTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.scheduleTemplate.findMany({ include: { route: true, vehicleTemplate: true }, orderBy: [{ route: { origin: "asc" } }, { departureTime: "asc" }] }),
    prisma.trip.findMany({ take: 30, orderBy: { departureAt: "desc" }, include: { route: true, vehicle: true, seats: { select: { status: true } } } }),
    prisma.booking.findMany({ take: 30, orderBy: { createdAt: "desc" }, include: { trip: { include: { route: true } }, payments: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.booking.count(),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } })
  ]);

  return NextResponse.json({
    routes, vehicles, vehicleTemplates, scheduleTemplates, trips, bookings,
    stats: { bookingCount, pendingPayments, paidAmount: pendingPayments >= 0 ? (paidPayments._sum.amount ?? 0) : 0 }
  });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return fail("Permintaan tidak valid.");

  try {
    if (body.action === "route") {
      const origin = typeof body.origin === "string" ? body.origin.trim() : "";
      const destination = typeof body.destination === "string" ? body.destination.trim() : "";
      if (origin.length < 2 || destination.length < 2 || origin.toLowerCase() === destination.toLowerCase()) return fail("Kota asal dan tujuan harus berbeda.");
      const route = await prisma.route.create({ data: { origin, destination } });
      return NextResponse.json({ route }, { status: 201 });
    }

    if (body.action === "vehicle") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const plate = typeof body.plate === "string" ? body.plate.trim().toUpperCase() : "";
      const capacity = Number(body.capacity);
      if (name.length < 2 || plate.length < 3 || !Number.isInteger(capacity) || capacity < 1 || capacity > 32) return fail("Nama armada, nomor polisi, atau kapasitas tidak valid.");
      const seatNos = Array.from({ length: capacity }, (_, index) => String(index + 1));
      const result = await prisma.$transaction(async (tx) => {
        const template = await tx.vehicleTemplate.create({
          data: { name, capacity, layout: { seats: seatNos } }
        });
        const vehicle = await tx.vehicle.create({
          data: { name, plate, templateId: template.id }
        });
        return { template, vehicle };
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (body.action === "schedule") {
      const routeId = typeof body.routeId === "string" ? body.routeId : "";
      const vehicleTemplateId = typeof body.vehicleTemplateId === "string" ? body.vehicleTemplateId : "";
      const departureTime = typeof body.departureTime === "string" ? body.departureTime : "";
      const durationMinutes = Number(body.durationMinutes);
      const basePrice = Number(body.basePrice);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime) || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440 || !Number.isInteger(basePrice) || basePrice < 1000) return fail("Jam, durasi, atau tarif jadwal tidak valid.");
      const [route, template] = await Promise.all([
        prisma.route.findUnique({ where: { id: routeId } }),
        prisma.vehicleTemplate.findUnique({ where: { id: vehicleTemplateId } })
      ]);
      if (!route?.active || !template) return fail("Rute atau tipe armada tidak ditemukan/aktif.");
      const schedule = await prisma.scheduleTemplate.create({
        data: { routeId, vehicleTemplateId, departureTime, durationMinutes, basePrice }
      });
      return NextResponse.json({ schedule }, { status: 201 });
    }

    if (body.action === "trip") {
      const templateId = typeof body.templateId === "string" ? body.templateId : "";
      const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId : "";
      const departureInput = typeof body.departureAt === "string" ? body.departureAt : "";
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(departureInput)) return fail("Tanggal dan jam keberangkatan tidak valid.");
      const departureAt = new Date(`${departureInput}:00+07:00`);
      if (Number.isNaN(departureAt.getTime()) || departureAt <= new Date()) return fail("Keberangkatan harus pada waktu mendatang.");
      const [template, vehicle] = await Promise.all([
        prisma.scheduleTemplate.findUnique({ where: { id: templateId }, include: { route: true, vehicleTemplate: true } }),
        prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { template: true } })
      ]);
      if (!template?.active || !template.route.active || !vehicle?.active || vehicle.templateId !== template.vehicleTemplateId) return fail("Template jadwal atau armada tidak sesuai.");
      const arrivalAt = new Date(departureAt.getTime() + template.durationMinutes * 60_000);
      const conflict = await prisma.trip.findFirst({
        where: { vehicleId, status: { in: ["SCHEDULED", "BOARDING"] }, departureAt: { lt: arrivalAt }, arrivalAt: { gt: departureAt } }
      });
      if (conflict) return fail("Armada sudah memiliki perjalanan pada rentang waktu tersebut.", 409);
      const price = departureAt.getDay() === 0 || departureAt.getDay() === 6
        ? (template.weekendPrice ?? template.basePrice) : template.basePrice;
      const seatNos = Array.from({ length: vehicle.template.capacity }, (_, index) => String(index + 1));
      const trip = await prisma.$transaction(async (tx) => {
        const created = await tx.trip.create({
          data: { templateId, routeId: template.routeId, vehicleId, departureAt, arrivalAt, price }
        });
        await tx.tripSeat.createMany({ data: seatNos.map((seatNo) => ({ tripId: created.id, seatNo })) });
        return created;
      });
      return NextResponse.json({ trip }, { status: 201 });
    }

    return fail("Aksi admin tidak dikenal.");
  } catch (error) {
    console.error("Admin data mutation failed", error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return fail("Data tersebut sudah terdaftar.", 409);
    return fail("Gagal menyimpan data. Periksa kembali isian dan koneksi database.", 500);
  }
}
