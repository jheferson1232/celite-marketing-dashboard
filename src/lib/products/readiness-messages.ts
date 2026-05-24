/** Formato de mensajes para el cliente (sin dependencias de Node/fs). */

export type ProductReadinessCheck = {
  ok: boolean
  label: string
  detail?: string
}

export function formatProductReadinessMessage(
  checks: ProductReadinessCheck[]
): string {
  const failed = checks.filter(
    (check) => !check.ok && check.label !== "Listo para publicar"
  )
  if (failed.length === 0) {
    return "Completa nombre, presupuesto, al menos una landing, videos y la config JSON del producto para pasar a Ready."
  }
  const parts = failed.map((check) =>
    check.detail ? `${check.label}: ${check.detail}` : check.label
  )
  return `Guardado. Para pasar a Ready falta: ${parts.join(" · ")}`
}
