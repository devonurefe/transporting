import { PrismaClient } from "@prisma/client";

// In Prisma 7, we don't need to specify URL in constructor if using config,
// but we can initialize the Prisma Client directly.
export const prisma = new PrismaClient();
