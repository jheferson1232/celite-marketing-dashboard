import { NextResponse } from "next/server"
import { isBufferApiKeyConfigured } from "@/lib/services/buffer/buffer-client"

/** Comprueba si el runtime ve BUFFER_API_KEY (sin exponer la clave). */
export async function GET() {
  return NextResponse.json({
    configured: isBufferApiKeyConfigured(),
  })
}
