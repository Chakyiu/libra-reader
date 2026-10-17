import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma";

const globalForPrisma = globalThis as unknown as { libraPrisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.libraPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.libraPrisma = db;
