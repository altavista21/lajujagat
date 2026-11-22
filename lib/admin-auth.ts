import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "lj_admin";
const SESSION_SECONDS = 8 * 60 * 60;

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createAdminSession() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  const payload = String(Date.now() + SESSION_SECONDS * 1000);
  return { value: `${payload}.${signature(payload, secret)}`, maxAge: SESSION_SECONDS };
}

export function isAdminRequest(request: Request) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const cookie = request.headers.get("cookie") ?? "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = entry?.slice(COOKIE_NAME.length + 1);
  if (!token) return false;
  const [payload, received] = token.split(".");
  if (!payload || !received || !/^\d+$/.test(payload) || Number(payload) <= Date.now()) return false;
  const expected = signature(payload, secret);
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const adminCookieName = COOKIE_NAME;
