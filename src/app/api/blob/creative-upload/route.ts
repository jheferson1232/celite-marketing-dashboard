import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import type { CreativeType } from "@/lib/services/creative"
import {
  creativeTypeFromBlobPath,
  isAllowedCreativeBlobPath,
} from "@/lib/services/blob/creative-paths"
import {
  assertBlobConfigured,
  getCreativeUploadLimits,
} from "@/lib/services/blob/media-utils"

function parseCreativeType(clientPayload: string | undefined): CreativeType | null {
  if (!clientPayload?.trim()) return null

  try {
    const parsed = JSON.parse(clientPayload) as { type?: unknown }
    if (parsed.type === "image" || parsed.type === "video") {
      return parsed.type
    }
  } catch {
    return null
  }

  return null
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertBlobConfigured()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Blob no configurado" },
      { status: 500 }
    )
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!isAllowedCreativeBlobPath(pathname)) {
          throw new Error("Ruta de subida no permitida")
        }

        const type =
          parseCreativeType(clientPayload ?? undefined) ??
          creativeTypeFromBlobPath(pathname)

        if (!type) {
          throw new Error("Tipo de creative no válido")
        }

        const pathType = creativeTypeFromBlobPath(pathname)
        if (pathType && pathType !== type) {
          throw new Error("El tipo del archivo no coincide con la ruta")
        }

        return {
          ...getCreativeUploadLimits(type),
          tokenPayload: clientPayload,
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el archivo" },
      { status: 400 }
    )
  }
}
