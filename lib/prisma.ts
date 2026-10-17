import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { databaseUrl } from "@/lib/env";

export function createPrismaClient(url: string = databaseUrl()): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
