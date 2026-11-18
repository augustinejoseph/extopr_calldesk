import "./env.mjs";
import postgres from "postgres";
let connection;
export function db() {
  if (!process.env.DATABASE_URL)
    throw Error("Configure DATABASE_URL and run npm run db:setup first");
  return (connection ||= postgres(process.env.DATABASE_URL, { max: 5 }));
}
