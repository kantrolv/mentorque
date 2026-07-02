import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the whole server.
export const prisma = new PrismaClient();
