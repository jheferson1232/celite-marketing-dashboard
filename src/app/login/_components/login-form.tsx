"use client"

import { useActionState, useState } from "react"
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line,
  RiMegaphoneLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { loginAction, type LoginState } from "../_actions/auth"

const initialState: LoginState = { error: null }

export function LoginForm({
  next,
  configured,
}: {
  next: string
  configured: boolean
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex items-center gap-3">
        <div className="bg-primary text-primary-foreground flex aspect-square size-10 items-center justify-center rounded-lg">
          <RiMegaphoneLine className="size-5" />
        </div>
        <div className="grid leading-tight">
          <span className="text-base font-semibold">Celite</span>
          <span className="text-muted-foreground text-xs">
            Marketing dashboard
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {configured ? (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Clave de acceso
              </label>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  required
                  disabled={pending}
                  aria-invalid={state.error ? true : undefined}
                  aria-describedby={state.error ? "login-error" : undefined}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
                  >
                    {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>

            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <RiLoader4Line className="animate-spin" /> : null}
              {pending ? "Entrando…" : "Entrar"}
            </Button>

            {state.error ? (
              <p
                id="login-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {state.error}
              </p>
            ) : null}
          </form>
        ) : (
          <div role="alert" className="flex flex-col gap-2 text-sm">
            <p className="font-medium">La app está bloqueada.</p>
            <p className="text-muted-foreground">
              Falta la variable de entorno{" "}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                APP_PASSWORD
              </code>
              . Agrégala en Vercel (o en <code className="font-mono text-xs">.env.local</code>{" "}
              para desarrollo) y vuelve a desplegar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
