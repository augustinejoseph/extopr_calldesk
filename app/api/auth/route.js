import { cookies } from "next/headers";
import { db } from "../../../lib/db.mjs";
import {
  currentUser,
  sameOrigin,
  token,
  verifyPassword,
} from "../../../lib/auth.mjs";
export async function GET() {
  return Response.json({ user: await currentUser() });
}
export async function POST(request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const { email, password } = await request.json();
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 256
    )
      throw Error("Invalid credentials");
    const sql = db(),
      key = email.trim().toLowerCase();
    const [limit] =
      await sql`insert into login_limits (email,attempts,reset_at) values (${key},1,now()+interval '15 minutes') on conflict(email) do update set attempts=case when login_limits.reset_at < now() then 1 else login_limits.attempts+1 end, reset_at=case when login_limits.reset_at < now() then now()+interval '15 minutes' else login_limits.reset_at end returning attempts`;
    if (limit.attempts > 10)
      return Response.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    const [user] =
      await sql`select * from users where email=${key} and deleted_at is null`;
    if (!user || !verifyPassword(password, user.password_hash))
      return Response.json(
        { error: "Email or password is incorrect" },
        { status: 401 },
      );
    await sql`delete from login_limits where email=${key}`;
    (await cookies()).set("session", token(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 86400,
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Login failed:", e.message);
    return Response.json(
      { error: "Sign-in unavailable. Check server configuration." },
      { status: 503 },
    );
  }
}
export async function DELETE(request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  (await cookies()).delete("session");
  return Response.json({ ok: true });
}
