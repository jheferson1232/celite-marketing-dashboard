import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { hasValidSession } from "@/lib/auth/server"
import { isAuthConfigured, safeRedirectPath } from "@/lib/auth/session"
import { LoginForm } from "./_components/login-form"

export const metadata: Metadata = {
  title: "Ingresar · Celite",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const params = await searchParams
  const next = safeRedirectPath(
    Array.isArray(params.next) ? params.next[0] : params.next
  )

  if (await hasValidSession()) {
    redirect(next)
  }

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-4">
      <LoginForm next={next} configured={isAuthConfigured()} />
    </main>
  )
}
