import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminCookieName, createAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !secret || secret.length < 32) {
    return NextResponse.json({ message: "Akses admin belum dikonfigurasi." }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (typeof body?.password !== "string") {
    return NextResponse.json({ message: "Masukkan password admin." }, { status: 400 });
  }
  const a = createHash("sha256").update(body.password).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ message: "Password admin salah." }, { status: 401 });
  }

  const session = createAdminSession();
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(adminCookieName, session.value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: session.maxAge
  });
  return response;
}
