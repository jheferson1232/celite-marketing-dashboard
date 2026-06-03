import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

/** Sube este número cuando cambie el schema y haya que invalidar el singleton en dev/serverless. */
const PRISMA_CLIENT_VERSION = 3

type GlobalPrismaStore = {
  prisma?: PrismaClient
  prismaVersion?: number
}

const globalStore = globalThis as unknown as GlobalPrismaStore

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })
  return new PrismaClient({ adapter })
}

function hasInformeModels(client: PrismaClient) {
  return Boolean(
    client.metaTrackEntity &&
      client.metaOperativeDay &&
      client.metaInformeAccountDay
  )
}

function hasPendingProductModels(client: PrismaClient) {
  return Boolean(client.dropiFavoriteProduct && client.pendingSyncRun)
}

function hasTikTokAgentModels(client: PrismaClient) {
  return Boolean(client.tikTokAgentSettings && client.tikTokAgentRun)
}

export function getPrismaClient(forceNew = false): PrismaClient {
  if (
    !forceNew &&
    globalStore.prisma &&
    globalStore.prismaVersion === PRISMA_CLIENT_VERSION &&
    hasInformeModels(globalStore.prisma) &&
    hasPendingProductModels(globalStore.prisma) &&
    hasTikTokAgentModels(globalStore.prisma)
  ) {
    return globalStore.prisma
  }

  void globalStore.prisma?.$disconnect().catch(() => {})

  const client = createPrismaClient()
  globalStore.prisma = client
  globalStore.prismaVersion = PRISMA_CLIENT_VERSION
  return client
}

/** Fuerza un cliente nuevo (p. ej. tras `prisma generate` sin reiniciar `pnpm dev`). */
export function resetPrismaClient(): PrismaClient {
  return getPrismaClient(true)
}

/** Siempre delega al singleton actual (evita cliente Prisma obsoleto en dev/HMR). */
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, client) as unknown
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
})

export default prisma
