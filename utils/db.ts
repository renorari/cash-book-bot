/*
    Prisma + PostgreSQL
*/

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/prisma/client.ts";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const pgAdapter = new PrismaPg({ "connectionString": process.env.DATABASE_URL });

export const prisma =
    globalForPrisma.prisma || new PrismaClient({ "adapter": pgAdapter } as Prisma.Subset<Prisma.PrismaClientOptions, Prisma.PrismaClientOptions>);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;