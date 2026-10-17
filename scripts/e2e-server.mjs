// Starts Libra for end-to-end tests against its own throwaway database and
// storage folder, never the development library. Builds first when needed.
import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, ".tmp", "e2e");
const env = {
  ...process.env,
  DATABASE_URL: `file:${path.join(dataDir, "libra-e2e.db")}`,
  LIBRA_STORAGE_DIR: path.join(dataDir, "uploads"),
  NODE_ENV: "production",
};
const port = process.env.E2E_PORT ?? "3200";

rmSync(dataDir, { recursive: true, force: true });
execSync("node scripts/copy-pdf-worker.mjs", { stdio: "inherit", env });
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...env, NODE_ENV: "test" } });

if (process.env.E2E_REBUILD === "1" || !existsSync(path.join(root, ".next", "BUILD_ID"))) {
  execSync("npx next build", { stdio: "inherit", env });
}

const server = spawn("npx", ["next", "start", "--port", port], { stdio: "inherit", env });
const stop = () => server.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
server.on("exit", (code) => process.exit(code ?? 0));
