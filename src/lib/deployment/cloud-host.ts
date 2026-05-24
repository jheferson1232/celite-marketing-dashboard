/** App desplegada en Vercel (producción o preview). */
export function isCloudHosted(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
      process.env.NEXT_PUBLIC_VERCEL_URL ||
      process.env.VERCEL === "1"
  )
}
