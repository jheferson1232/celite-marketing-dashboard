import { NextResponse } from "next/server"
import { isSociaVaultApiKeyConfigured } from "@/lib/services/sociavault/sociavault-setup"

/** Comprueba si el servidor ve SOCIAVAULT_API_KEY (sin exponer la clave). */
export async function GET() {
  return NextResponse.json({
    configured: isSociaVaultApiKeyConfigured(),
  })
}
