import prisma from "@/lib/prisma"

export type InformePrismaClient = {
  metaTrackEntity: NonNullable<(typeof prisma)["metaTrackEntity"]>
  metaOperativeDay: NonNullable<(typeof prisma)["metaOperativeDay"]>
  metaInformeAccountDay: NonNullable<(typeof prisma)["metaInformeAccountDay"]>
}

/** Cliente Prisma con tablas del Informe IA (evita singleton viejo en dev). */
export function getInformePrisma(): InformePrismaClient {
  const track = prisma.metaTrackEntity
  const day = prisma.metaOperativeDay
  const accountDay = prisma.metaInformeAccountDay

  if (!track?.deleteMany || !day?.deleteMany || !accountDay?.upsert) {
    throw new Error(
      "Base de datos del informe no está actualizada en este servidor. " +
        "Redespliega la app (build con prisma generate) y ejecuta `pnpm db:push` en Neon."
    )
  }

  return {
    metaTrackEntity: track,
    metaOperativeDay: day,
    metaInformeAccountDay: accountDay,
  }
}
