import { readFile } from "node:fs/promises";
import { scryptSync, randomBytes } from "node:crypto";
import postgres from "postgres";
if (
  !process.env.DATABASE_URL ||
  !process.env.MANAGER_EMAIL ||
  (process.env.MANAGER_PASSWORD || "").length < 12
)
  throw Error(
    "Set DATABASE_URL, MANAGER_EMAIL and MANAGER_PASSWORD (12+ characters). Load .env.local with node --env-file=.env.local scripts/setup.mjs",
  );
const sql = postgres(process.env.DATABASE_URL);
try {
  await sql.unsafe(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  const salt = randomBytes(16).toString("hex");
  const hash = `${salt}:${scryptSync(process.env.MANAGER_PASSWORD, salt, 64).toString("hex")}`;
  await sql`insert into users (name,email,password_hash,role) values (${process.env.MANAGER_NAME || "Manager"},${process.env.MANAGER_EMAIL.toLowerCase()},${hash},'manager') on conflict(email) do nothing`;
  console.log("Database ready. Existing accounts were preserved.");
} finally {
  await sql.end();
}
