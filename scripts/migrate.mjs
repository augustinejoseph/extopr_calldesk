import "../lib/env.mjs";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
if (!process.env.DATABASE_URL) throw Error("Set DATABASE_URL");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
try {
  await sql.begin((tx) => tx.unsafe(schema));
  console.log("Database schema updated. Existing records preserved.");
} finally {
  await sql.end();
}
