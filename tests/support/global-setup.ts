import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/** A fresh, migrated SQLite database for integration tests; never the dev database. */
export default function setup() {
  const dir = path.resolve(process.cwd(), ".tmp/test");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${path.join(dir, "libra-test.db")}` },
  });
}
