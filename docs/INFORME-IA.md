# Informe IA (Meta)

Pestaña `/informe-ia` y cron horario a Telegram. **No modifica** el dashboard principal (`/dashboard`).

## Qué hace

1. **Tabla** — Campañas y conjuntos con gasto (ayer o hoy), puntos por día, estado automático, filas rojas/naranjas.
2. **Persistencia** — `MetaOperativeDay` y `MetaInformeAccountDay` en PostgreSQL.
3. **Cron** — Cada hora (`0 * * * *` → `/api/cron/meta-telegram-reports`): resumen + sugerencias de apagar conjuntos/campañas sin ventas.
4. **Cierre 23:00** (America/Lima) — Informe nocturno adicional con olvidos, sin ventas y CPA alto.

OpenAI (`gpt-4o-mini`) solo redacta el texto de Telegram si existe `OPENAI_API_KEY`; los puntos y umbrales son reglas fijas en código.

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
| `META_INFORME_START_DATE` | No | Primer día del historial (`YYYY-MM-DD`). No puede ser anterior a ayer (Lima). |

Copia `.env.example` y rellena los valores.

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

## Cron en Vercel

`vercel.json` define el schedule (compatible con plan **Hobby**: máximo una ejecución por día por entrada):

| Horario (UTC) | Uso aproximado (Lima UTC−5) |
|---------------|-----------------------------|
| `0 14 * * *` | ~09:00 — informe operativo a Telegram |
| `0 4 * * *` | ~23:00 — cierre diario (si la hora del servidor coincide con 23 en Lima) |

En plan **Pro** puedes cambiar a `0 * * * *` para informe **cada hora**.

**Informe cada hora en Hobby:** usa un cron externo (p. ej. [cron-job.org](https://cron-job.org)) que haga `GET` a `/api/cron/meta-telegram-reports` con `Authorization: Bearer <CRON_SECRET>` cada hora.

En el proyecto de Vercel:

- `CRON_SECRET` — mismo valor que usarás al probar el endpoint.
- Resto de variables de la tabla anterior.

Probar manualmente:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://TU_DOMINIO/api/cron/meta-telegram-reports"
```

## Reglas de puntos (resumen)

- **+1** — CPA &lt; 10k COP con ventas.
- **0** — CPA intermedio o sin datos relevantes.
- **−1** — Sin ventas con gasto ≥ 10k, o CPA &gt; 15k con ventas.
- Columna **Puntos** — Suma ayer+hoy con tope **−1** por fila.
- **Olvido** — Ayer hubo gasto y Meta estaba apagado; no notifica si puntos totales ≤ −3.

## Sugerencias de apagar (Telegram)

- **Conjunto** — Gasto hoy ≥ 10k COP y 0 compras.
- **Campaña** — Gasto hoy ≥ 30k COP y 0 compras.

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/lib/services/meta/meta-operative-service.ts` | Payload tabla + sync |
| `src/lib/services/meta/meta-informe-scoring.ts` | Umbrales y puntos |
| `src/lib/services/meta/meta-informe-alerts.ts` | Listas apagar / resumen campañas |
| `src/lib/services/meta/meta-hourly-report.ts` | Mensaje horario + envío |
| `src/lib/services/meta/meta-telegram-cron.ts` | Orquestación cron |
| `src/app/(app)/informe-ia/` | UI |

## Script local (opcional)

```bash
pnpm tsx scripts/test-meta-hourly-cron.ts
```

Requiere `.env` cargado y credenciales Meta/Telegram válidas.
