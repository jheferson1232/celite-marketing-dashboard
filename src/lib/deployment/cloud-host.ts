function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  )
}

/** App desplegada en Vercel (servidor o build en la nube). */
export function isCloudHosted(): boolean {
  if (process.env.NEXT_PUBLIC_CLOUD_HOSTED === "1") return true
  if (
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL === "1"
  ) {
    return true
  }
  if (typeof window !== "undefined") {
    return !isLocalHostname(window.location.hostname)
  }
  return false
}
