import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const routes = await prisma.route.findMany({
    where: { active: true },
    select: { origin: true, destination: true },
    orderBy: [{ origin: "asc" }, { destination: "asc" }]
  });
  return NextResponse.json({
    routes,
    origins: [...new Set(routes.map((route) => route.origin))],
    destinations: [...new Set(routes.map((route) => route.destination))]
  });
}
