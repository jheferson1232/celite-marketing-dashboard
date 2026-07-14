import { NextResponse } from "next/server"
import type { CreativeType } from "@/lib/services/creative"
import {
  creativeTypeFromBlobPath,
  isAllowedCreativeBlobPath,
} from "@/lib/services/blob/creative-paths"
import {
  assertR2Configured,
  buildR2PublicUrl,
} from "@/lib/services/r2/client"
import { presignR2Upload } from "@/lib/services/r2/server"
import {
  getCreativeUploadLimits,
} from "@/lib/services/blob/media-utils"

type PresignRequest = {
  pathname?: unknown
  contentType?: unknown
  type?: unknown
}

function isCreativeType(value: unknown): value is CreativeType {
  return value === "image" || value === "video"
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertR2Configured()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "R2 no configurado" },
      { status: 500 }
    )
  }

  let body: PresignRequest
  try {
    body = (await request.json()) as PresignRequest
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const pathname = typeof body.pathname === "string" ? body.pathname : ""
  const contentType = typeof body.contentType === "string" ? body.contentType.trim() : ""

  if (!pathname || !isAllowedCreativeBlobPath(pathname)) {
    return NextResponse.json(
      { error: "Ruta de subida no permitida" },
      { status: 400 }
    )
  }

  const type =
    isCreativeType(body.type) ? body.type : creativeTypeFromBlobPath(pathname)

  if (!type) {
    return NextResponse.json(
      { error: "Tipo de creative no válido" },
      { status: 400 }
    )
  }

  const pathType = creativeTypeFromBlobPath(pathname)
  if (pathType && pathType !== type) {
    return NextResponse.json(
      { error: "El tipo del archivo no coincide con la ruta" },
      { status: 400 }
    )
  }

  const limits = getCreativeUploadLimits(type)
  if (contentType && !limits.allowedContentTypes.includes(contentType)) {
    return NextResponse.json(
      { error: "Content-Type no permitido" },
      { status: 400 }
    )
  }

  try {
    const uploadUrl = await presignR2Upload(pathname, {
      contentType: contentType || undefined,
      expiresIn: 120,
    })
    return NextResponse.json({
      uploadUrl,
      publicUrl: buildR2PublicUrl(pathname),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo generar la URL",
      },
      { status: 500 }
    )
  }
}
