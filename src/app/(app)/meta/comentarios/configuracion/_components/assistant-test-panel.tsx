"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  RiFlashlightLine,
  RiLoader4Line,
  RiSendPlaneLine,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  MetaCommentActionKind,
  MetaCommentClassification,
} from "@/lib/services/meta/comments/types"
import {
  getMetaCommentAssistantTestContextAction,
  listMetaCommentPagesForTestAction,
  listMetaCommentProductsAction,
  testMetaCommentAssistantAction,
} from "../../_actions/meta-comments-config"
import { ConfigCard } from "./config-form-parts"

type ChatTurn = {
  id: string
  role: "user" | "assistant"
  text: string
  meta?: {
    classification: MetaCommentClassification
    action: MetaCommentActionKind
    replyText: string | null
  }
}

const CLASSIFICATION_LABEL: Record<MetaCommentClassification, string> = {
  spam: "Spam",
  troll: "Troll / negativo",
  question: "Pregunta",
  positive: "Positivo",
  neutral: "Neutral",
}

const ACTION_LABEL: Record<MetaCommentActionKind, string> = {
  hide: "Ocultar comentario",
  reply: "Responder en público",
  skip: "No hacer nada",
}

const ACTION_BADGE: Record<
  MetaCommentActionKind,
  "destructive" | "default" | "secondary"
> = {
  hide: "destructive",
  reply: "default",
  skip: "secondary",
}

function AssistantBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {turn.text}
        </div>
      </div>
    )
  }

  const meta = turn.meta
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2 rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
        {meta ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ACTION_BADGE[meta.action]}>
              {ACTION_LABEL[meta.action]}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {CLASSIFICATION_LABEL[meta.classification]}
            </span>
          </div>
        ) : null}
        <p className="whitespace-pre-wrap">{turn.text}</p>
        {meta?.action === "reply" && meta.replyText ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <p className="text-muted-foreground mb-1 text-xs">
              Respuesta en Facebook:
            </p>
            <p>{meta.replyText}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AssistantTestPanel() {
  const [started, setStarted] = useState(false)
  const [pageId, setPageId] = useState<string>("")
  const [productId, setProductId] = useState<string>("")
  const [keyword, setKeyword] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [turns, setTurns] = useState<ChatTurn[]>([])

  const pagesQuery = useQuery({
    queryKey: ["meta-comment-test-pages"],
    queryFn: () => runServerAction(listMetaCommentPagesForTestAction()),
  })

  const productsQuery = useQuery({
    queryKey: ["meta-comment-test-products"],
    queryFn: () => runServerAction(listMetaCommentProductsAction()),
  })

  const startMutation = useMutation({
    mutationFn: () =>
      runServerAction(
        getMetaCommentAssistantTestContextAction({
          pageId: pageId || null,
          productId: productId || null,
        })
      ),
    onSuccess: (ctx) => {
      if (!ctx) return
      setStarted(true)
      setKeyword(ctx.keyword)
      setTurns([])
      if (ctx.keyword) {
        setInput(ctx.keyword)
      }
    },
  })

  const testMutation = useMutation({
    mutationFn: (message: string) =>
      runServerAction(
        testMetaCommentAssistantAction({
          message,
          pageId: pageId || null,
          productId: productId || null,
        })
      ),
    onSuccess: (result, message) => {
      if (!result) return
      const assistantText =
        result.action === "reply" && result.replyText
          ? result.replyText
          : result.action === "hide"
            ? "El agente ocultaría este comentario en Facebook."
            : "El agente no tomaría acción sobre este comentario."

      setTurns((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          text: message,
        },
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: assistantText,
          meta: {
            classification: result.classification,
            action: result.action,
            replyText: result.replyText,
          },
        },
      ])
      setInput("")
    },
  })

  const busy = startMutation.isPending || testMutation.isPending
  const products = productsQuery.data?.filter((p) => p.active) ?? []
  const pages = pagesQuery.data ?? []

  function handleSend() {
    const message = input.trim()
    if (!message || !started || busy) return
    testMutation.mutate(message)
  }

  return (
    <ConfigCard title="Prueba tu asistente">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Simulá comentarios sin publicar en Facebook. Usa la configuración
          guardada y el catálogo de productos.
        </p>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={busy || started}
          onClick={() => startMutation.mutate()}
        >
          {startMutation.isPending ? (
            <RiLoader4Line className="size-4 animate-spin" />
          ) : (
            <RiFlashlightLine className="size-4" />
          )}
          Iniciar prueba
        </Button>
      </div>

      {!started ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Página (opcional)</label>
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Automática</option>
              {pages.map((page) => (
                <option key={page.pageId} value={page.pageId}>
                  {page.pageName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Producto (opcional)</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Primer producto activo</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "relative min-h-72 overflow-hidden rounded-2xl border",
          started
            ? "bg-muted/30"
            : "bg-zinc-800 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] bg-size-[16px_16px]"
        )}
      >
        <div className="flex max-h-96 min-h-72 flex-col gap-3 overflow-y-auto p-4">
          {!started ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-lg font-medium text-zinc-100">
                ¿Listo para probar tu asistente?
              </p>
              <p className="text-sm text-zinc-400">
                Presiona &quot;Iniciar prueba&quot; para comenzar
              </p>
            </div>
          ) : turns.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">
                Escribí un comentario como si fuera de Facebook
              </p>
              {keyword ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Palabra clave cargada: <strong>{keyword}</strong>
                </p>
              ) : null}
            </div>
          ) : (
            turns.map((turn) => <AssistantBubble key={turn.id} turn={turn} />)
          )}
          {testMutation.isPending ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <RiLoader4Line className="size-4 animate-spin" />
              Claude está analizando…
            </div>
          ) : null}
          {testMutation.isError ? (
            <p className="text-destructive text-sm">
              {testMutation.error instanceof Error
                ? testMutation.error.message
                : "Error al probar el asistente"}
            </p>
          ) : null}
          {startMutation.isError ? (
            <p className="text-destructive text-sm">
              {startMutation.error instanceof Error
                ? startMutation.error.message
                : "No se pudo iniciar la prueba"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          disabled={!started || busy}
          placeholder={
            started
              ? "Escribí un comentario de prueba…"
              : "Iniciá la prueba para cargar la palabra clave automáticamente"
          }
          rows={2}
          className="min-h-12 resize-none"
        />
        <Button
          type="button"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={!started || busy || !input.trim()}
          onClick={handleSend}
          aria-label="Enviar comentario de prueba"
        >
          <RiSendPlaneLine className="size-4" />
        </Button>
      </div>

      {started ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setStarted(false)
              setTurns([])
              setInput("")
              setKeyword(null)
            }}
          >
            Reiniciar prueba
          </Button>
        </div>
      ) : null}
    </ConfigCard>
  )
}
