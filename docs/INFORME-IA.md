# Informe IA (Meta)

Pestaña `/informe-ia` y cron horario a Telegram. **No modifica** el dashboard principal (`/dashboard`).

## Qué hace

1. **Tabla** — Campañas y conjuntos con gasto (ayer o hoy), puntos por día, estado automático, filas rojas/naranjas.
2. **Persistencia** — `MetaOperativeDay` y `MetaInformeAccountDay` en PostgreSQL.
3. **Cron** — Cada hora (GitHub Actions → `/api/cron/meta-telegram-reports`): resumen + sugerencias de apagar conjuntos/campañas sin ventas.
4. **Cierre 23:00** (America/Lima) — Informe nocturno adicional con sin ventas y CPA alto.

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

## Cron horario (GitHub Actions — recomendado en Hobby)

El plan **Hobby** de Vercel no permite crons más de una vez al día. El informe **cada hora** lo dispara el workflow [`.github/workflows/meta-telegram-hourly.yml`](../.github/workflows/meta-telegram-hourly.yml) (`0 * * * *` UTC).

### Configuración (una vez)

1. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - `CRON_SECRET` — **el mismo valor** que en Vercel (sin espacios al inicio/final).
2. (Opcional) **Variables → Actions → New repository variable**
   - `META_CRON_APP_URL` — URL de producción si no es `https://celite-marketing-dashboard.vercel.app`
3. **Actions** debe estar habilitado en el repo (pestaña Actions → el workflow aparece tras el push).

Probar sin esperar la hora:

- GitHub → **Actions** → **Meta Telegram hourly** → **Run workflow**.

El endpoint ejecuta el informe operativo en cada llamada y el **cierre nocturno** solo cuando la hora en **America/Lima** es 23.

### Alternativa: cron-job.org

Si prefieres no usar GitHub Actions:

| Campo | Valor |
|-------|--------|
| URL | `https://celite-marketing-dashboard.vercel.app/api/cron/meta-telegram-reports` |
| Método | GET |
| Cabecera | `Authorization: Bearer <CRON_SECRET>` |
| Intervalo | Cada 1 hora |

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

Evaluación del día (prioridad de arriba a abajo):

- **Gasto alto ayer** — Ayer gastó ≥ 10k COP.
- **—** — Hoy sin gasto.
- **Sin ventas** — Hoy con gasto y 0 compras (rojo si gasto ≥ 10k o entre 5k–10k).
- **CPA alto** — Hoy con ventas y CPA &gt; 15k COP.
- **OK** — Hoy con ventas y CPA aceptable (+1 si CPA &lt; 10k).

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
