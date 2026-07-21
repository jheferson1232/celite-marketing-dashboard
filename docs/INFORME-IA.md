# Informe IA (Meta)

Pestaña `/informe-ia` y cron horario a Telegram. **No modifica** el dashboard principal (`/dashboard`).

## Qué hace

1. **Tabla** — Campañas y conjuntos con gasto (ayer o hoy), puntos por día, estado automático, filas rojas/naranjas.
2. **Persistencia** — `MetaOperativeDay` y `MetaInformeAccountDay` en PostgreSQL.
3. **Cron** — 1×/día a las 8:00 (America/Lima) vía GitHub Actions → `/api/cron/meta-telegram-reports`: conjuntos ON en Crítico.
4. **Cierre 23:00** (America/Lima) — Solo si el cron corre a esa hora (p. ej. manual); con el schedule diario 8:00 no se envía solo.
5. **Voz (consulta)** — Botón «Hablar del informe»: OpenAI Realtime (WebRTC). Solo consulta el snapshot del informe; no apaga ni edita Meta.

OpenAI (`gpt-4o-mini`) redacta el **cierre nocturno** de Telegram si existe `OPENAI_API_KEY`. La voz del informe usa Realtime (`gpt-realtime-2.1`) con la misma key.

## Variables de entorno

| Variable | Requerida | Uso |
|----------|-----------|-----|
| `META_ACCESS_TOKEN` | Sí | API Meta Ads |
| `META_AD_ACCOUNT_ID` | Sí | Cuenta publicitaria |
| `DATABASE_URL` | Sí | Prisma / historial |
| `CRON_SECRET` | Sí (prod) | `Authorization: Bearer …` en el cron |
| `TELEGRAM_BOT_TOKEN` | Sí (alertas) | Bot de @BotFather |
| `TELEGRAM_ALLOWED_USER_IDS` | Sí (alertas) | IDs separados por coma |
| `OPENAI_API_KEY` | No | Cierre nocturno Telegram + voz conversacional del informe |
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

## Cron diario (GitHub Actions — recomendado en Hobby)

El plan **Hobby** de Vercel no permite crons más de una vez al día. El informe lo dispara [`.github/workflows/meta-telegram-daily.yml`](../.github/workflows/meta-telegram-daily.yml) **1×/día a las 8:00 America/Lima** (`0 13 * * *` UTC).

> Para reducir uso de Neon Free, el historial en BD/sync está limitado a **7 días** (`META_INFORME_MAX_DAYS`).

### Configuración (una vez)

1. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - `CRON_SECRET` — **el mismo valor** que en Vercel (sin espacios al inicio/final).
2. (Opcional) **Variables → Actions → New repository variable**
   - `META_CRON_APP_URL` — URL de producción si no es `https://celite-marketing-dashboard.vercel.app`
3. **Actions** debe estar habilitado en el repo (pestaña Actions → el workflow aparece tras el push).

Probar sin esperar la hora:

- GitHub → **Actions** → **Meta Telegram daily** → **Run workflow**.

El endpoint sincroniza el informe (ventana de 7 días) y envía Telegram. El **cierre nocturno** (23:00 Lima) solo corre si la llamada cae en esa hora.

### Alternativa: cron-job.org

Si prefieres no usar GitHub Actions:

| Campo | Valor |
|-------|--------|
| URL | `https://celite-marketing-dashboard.vercel.app/api/cron/meta-telegram-reports` |
| Método | GET |
| Cabecera | `Authorization: Bearer <CRON_SECRET>` |
| Intervalo | 1×/día (p. ej. `0 13 * * *` UTC = 8:00 Lima) |

### Plan Vercel Pro

Puedes volver a poner en `vercel.json` un cron `0 * * * *` (Pro) y desactivar el workflow de GitHub si quieres todo en Vercel.

### Variables en Vercel

- `CRON_SECRET` — obligatorio para el endpoint (GitHub Actions y pruebas manuales).
- Resto de variables de la tabla superior.

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
| `src/lib/services/meta/meta-telegram-cron.ts` | Orquestación cron |
| `src/lib/services/meta/meta-informe-voice.ts` | Resumen + token Realtime (voz consulta) |
| `src/app/(app)/informe-ia/` | UI (tabla + panel voz) |
