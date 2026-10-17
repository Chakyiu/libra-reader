import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const DEFAULT_DATABASE_URL = "file:./data/libra.db";

function absoluteSqliteUrl(url: string): string {
  const file = url.replace(/^file:/, "");
  return path.isAbsolute(file) ? `file:${file}` : `file:${path.resolve(process.cwd(), file)}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: absoluteSqliteUrl(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL),
  },
});
