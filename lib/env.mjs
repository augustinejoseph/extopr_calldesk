import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

let config = process.env.APP_CONFIG;
if (config === undefined) {
  try {
    config = parseEnv(
      readFileSync(resolve(process.cwd(), ".env.local"), "utf8"),
    ).APP_CONFIG;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

if (config !== undefined) {
  const values = JSON.parse(config);
  if (
    !values ||
    Array.isArray(values) ||
    typeof values !== "object" ||
    Object.values(values).some((value) => typeof value !== "string")
  ) {
    throw Error("APP_CONFIG must be a JSON object with string values");
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] ??= value;
  }
}
