import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db.mjs";
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  const expected = Buffer.from(key, "hex");
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}
function secret() {
  if ((process.env.SESSION_SECRET || "").length < 32)
    throw Error("SESSION_SECRET must have at least 32 characters");
  return process.env.SESSION_SECRET;
}
export function token(id) {
  const body = Buffer.from(
    JSON.stringify({ id, exp: Date.now() + 86400000 }),
  ).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("hex")}`;
}
export async function currentUser() {
  const value = (await cookies()).get("session")?.value;
  if (!value) return null;
  try {
    const [body, sig] = value.split(".");
    const expected = createHmac("sha256", secret()).update(body).digest("hex");
    if (
      !sig ||
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null;
    const data = JSON.parse(Buffer.from(body, "base64url"));
    if (data.exp < Date.now()) return null;
    const [user] =
      await db()`select id,name,email,role from users where id=${data.id} and deleted_at is null`;
    return user || null;
  } catch {
    return null;
  }
}
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
