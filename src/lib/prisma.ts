import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  return new PrismaClient({ adapter })
}

function hasInformeModels(client: PrismaClient) {
  return Boolean(client.metaTrackEntity && client.metaOperativeDay)
}

let prisma = globalForPrisma.prisma ?? createPrismaClient()

if (!hasInformeModels(prisma)) {
  prisma = createPrismaClient()
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma
