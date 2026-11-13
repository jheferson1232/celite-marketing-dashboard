# Informe IA (Meta)

Pestaña `/informe-ia` y cron horario a Telegram. **No modifica** el dashboard principal (`/dashboard`).

## Qué hace

1. **Tabla** — Campañas y conjuntos con gasto (ayer o hoy), puntos por día, estado automático, filas rojas/naranjas.
2. **Persistencia** — `MetaOperativeDay` y `MetaInformeAccountDay` en PostgreSQL.
3. **Cron** — 2×/día a las **8:00** y **20:00** (America/Lima) vía Vercel Schedules → `/crons/meta-telegram-reports`: conjuntos ON en Crítico.
4. **Cierre 23:00** (America/Lima) — Solo si el cron corre a esa hora (p. ej. manual); con el schedule 8:00/20:00 no se envía solo.

OpenAI (`gpt-4o-mini`) solo redacta el **cierre nocturno** de Telegram si existe `OPENAI_API_KEY`; el informe horario y los umbrales son reglas fijas en código.

## Variables de entorno

| Variable | Requerida | Uso |
|----------|-----------|-----|
| `META_ACCESS_TOKEN` | Sí | API Meta Ads |
| `META_AD_ACCOUNT_ID` | Sí | Cuenta publicitaria |
| `DATABASE_URL` | Sí | Prisma / historial |
| `CRON_SECRET` | Sí (prod) | `Authorization: Bearer …` en el cron |
| `TELEGRAM_BOT_TOKEN` | Sí (alertas) | Bot de @BotFather |
| `TELEGRAM_ALLOWED_USER_IDS` | Sí (alertas) | IDs separados por coma |
| `OPENAI_API_KEY` | No | Texto más natural en Telegram |
| `META_INFORME_MAX_DAYS` | No | Ventana en tabla/sync (default **7** días, Lima). |
| `META_INFORME_START_DATE` | No | Inicio fijo opcional (`YYYY-MM-DD`, Lima), acotado por `META_INFORME_MAX_DAYS`. |

Configura estas variables en tu archivo `.env` (local) o en Vercel →
Settings → Environment Variables (entorno Production).

## Base de datos

Tras cambios de schema:

```bash
pnpm db push
pnpm prisma generate
```

En Vercel, ejecuta `db push` contra la misma `DATABASE_URL` de producción.

## Telegram

1. Crea el bot con @BotFather → `TELEGRAM_BOT_TOKEN`.
2. Obtén tu ID con @userinfobot → `TELEGRAM_ALLOWED_USER_IDS`.
3. En la app: **Vista previa** (no envía) o **Enviar a Telegram** (mismo mensaje que el cron).

## Cron (Vercel Schedules)

Los crons viven en [`vercel.json`](../vercel.json) (`schedules`, plan Pro) con `timezone: America/Lima`. Vercel llama por GET a las rutas `/crons/*` y envía `Authorization: Bearer <CRON_SECRET>`.

| Schedule | Ruta | Hora (Lima) |
|----------|------|-------------|
| `tiktok-activate-6am` | `/crons/tiktok-activate-6am` | 6:00 |
| `meta-telegram-8am` / `meta-telegram-8pm` | `/crons/meta-telegram-reports` | 8:00 y 20:00 |
| `tiktok-agent-8am` / `-2pm` / `-8pm` | `/crons/tiktok-agent` | 8:00, 14:00, 20:00 |
| `meta-comments-2h` | `/crons/meta-comments-agent` | cada 2 h |

El agente de comentarios TikTok no tiene cron: se ejecuta solo con «Ejecutar ahora» en `/tiktok/comentarios`.

El agente TikTok deduce el trigger del header `ce-vssschedulename`; en llamadas manuales usa `?trigger=morning_8am|afternoon_2pm|evening_8pm`.

> Para reducir uso de Neon Free, el historial en BD/sync está limitado a **7 días** (`META_INFORME_MAX_DAYS`).

### Variables en Vercel

- `CRON_SECRET` — obligatorio (Production). Sin él, Vercel no envía el header y las rutas responden 401.
- Resto de variables de la tabla superior.

### Probar sin esperar la hora

```bash
vercel schedules list
vercel schedules invoke meta-telegram-8am

# Manual / dry run (los agentes aceptan ?dryRun=1)
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://celite-marketing-dashboard.vercel.app/crons/tiktok-agent?trigger=morning_8am&dryRun=1"
```

El endpoint del informe sincroniza (ventana de 7 días) y envía Telegram. El **cierre nocturno** (23:00 Lima) solo corre si la llamada cae en esa hora.

## Reglas de puntos (resumen)

- **+1** — CPA &lt; 10k COP con ventas.
- **0** — CPA intermedio o sin datos relevantes.
- **−1** — Sin ventas con gasto ≥ 10k, o CPA &gt; 15k con ventas.
- Columna **Puntos** — Suma ayer+hoy con tope **−1** por fila.
## Estados en tabla (columna Estado)

**Campañas:** veredicto corto generado con OpenAI (o regla fija si no hay `OPENAI_API_KEY`), leyendo Meta 7 / 15 / 30 días y total + datos del informe (hoy/ayer). Sin columnas extra de métricas. Textos: **Seguir activando**, **No seguir**, **Revisar** (CPA referencia ≤ 20k COP).

**Conjuntos:** reglas operativas del día (Gasto alto ayer, Sin ventas, CPA alto, OK, —).

## Mensaje horario Telegram

Solo lista conjuntos a revisar (mismo criterio que la columna Estado: CPA &gt; 20k o ≥ 10k sin compras hoy, interruptor ON). Ej.: `cost 12 (21-10 cost cap…) · $24,043 · 1 compra(s) · CPA $24,043`.

No incluye resumen de cuenta, campañas activas ni listas “a apagar”. Si no hay ninguno en Crítico, el mensaje lo indica.

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/lib/services/meta/meta-operative-service.ts` | Payload tabla + sync |
| `src/lib/services/meta/meta-informe-scoring.ts` | Umbrales y puntos (conjuntos) |
| `src/lib/services/meta/campaign-multi-window-metrics.ts` | Meta 7/15/30/total por campaña |
| `src/lib/services/meta/meta-campaign-ai-estado.ts` | Veredicto IA campañas |
| `src/lib/services/meta/meta-informe-alerts.ts` | Listas apagar / resumen campañas |
| `src/lib/services/meta/meta-hourly-report.ts` | Mensaje horario + envío |
| `src/app/crons/meta-telegram-reports/route.ts` | Cron: orquestación y cierre nocturno |
| `src/app/(app)/informe-ia/` | UI |
