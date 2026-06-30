# Base de datos para Vercel (asistente IA + Telegram)

El asistente en Meta/TikTok y el historial de chats usan **PostgreSQL** vía Prisma. `localhost` no funciona en Vercel.

## Configuración rápida con Neon

1. En [Vercel Dashboard](https://vercel.com) → tu proyecto → **Storage** → **Create Database** → **Neon**.
2. Conecta la base al proyecto `celite-marketing-dashboard`.
3. Vercel creará `DATABASE_URL` (pooler) y `DATABASE_URL_UNPOOLED` (directa). El build prioriza la directa para `prisma migrate deploy`.
   - Si solo tienes `DATABASE_URL` con `-pooler` en el host, se deriva la URL directa automáticamente.
   - En **Settings → Environment Variables**, activa las variables para **Production**, **Preview** y **Build** (no solo Runtime).
   - Opcional: `DIRECT_URL` o `POSTGRES_PRISMA_URL` si usas plantillas antiguas de Vercel Postgres.
   - Si el build falla con **P1002**: añade manualmente `DATABASE_URL_UNPOOLED` con la connection string **Direct** de Neon (sin `pooler` en el host).
4. En tu máquina, con la URL de producción copiada:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   ```

5. **Redeploy** en Vercel (Deployments → Redeploy).

## SociaVault (productos pendientes)

1. [Vercel](https://vercel.com) → proyecto → **Settings** → **Environment Variables**.
2. Añade **`SOCIAVAULT_API_KEY`** = tu clave `sk_live_…` de [sociavault.com/dashboard](https://sociavault.com/dashboard).
3. Activa **Production** (y Preview si usas previews). Sin comillas en el valor.
4. Opcional: `SOCIAVAULT_SEARCH_TIKTOK=true`, `SOCIAVAULT_AD_LIBRARY_COUNTRY=VE`, `BLOB_READ_WRITE_TOKEN`.
5. **Redeploy** obligatorio tras guardar variables.
6. Comprueba: `https://TU-DOMINIO.vercel.app/api/health/sociavault` debe responder `{"configured":true}`.

## Comprobar conexión local

```bash
pnpm exec tsx scripts/check-db.ts
```

Si ves aviso de `localhost`, actualiza `.env` y las variables en Vercel antes de desplegar.

## Cambiar de cuenta o proyecto Neon

Útil si agotaste la cuota Free (5 GB/mes) y quieres una base nueva con cuota limpia.

### Variables en Vercel (Settings → Environment Variables)

Actualiza **las mismas claves** con las URLs del proyecto Neon nuevo. Marca **Production**, **Preview** y **Build** en cada una.

| Variable | Obligatoria | Valor en Neon Console |
|----------|-------------|------------------------|
| `DATABASE_URL` | Sí | Connection string **Pooled** (host con `-pooler`, puerto 6543) |
| `DATABASE_URL_UNPOOLED` | Recomendada | Connection string **Direct** (sin `pooler`, puerto 5432) |

Alternativas que también entiende el build (solo si ya las usabas): `DIRECT_URL`, `DATABASE_DIRECT_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`.

**No hace falta cambiar** para el cambio de BD: `CRON_SECRET`, tokens Meta/TikTok, `TELEGRAM_*`, `BLOB_READ_WRITE_TOKEN`, etc.

### Desconectar la integración vieja (opcional)

Vercel → **Storage** → base Neon anterior → desconectar o dejar de usar sus variables. Evita que un redeploy vuelva a inyectar la URL bloqueada.

### Crear tablas en la BD nueva

En tu máquina, con la URL **Direct** del proyecto nuevo:

```bash
DATABASE_URL="postgresql://..." pnpm exec prisma migrate deploy
```

Comprobar:

```bash
DATABASE_URL="postgresql://..." pnpm exec tsx scripts/check-db.ts
```

Debe responder: `OK: conexión a la base de datos correcta.`

### Redeploy

Vercel → **Deployments** → **Redeploy** (Production). El script `scripts/vercel-build.mjs` ejecuta `prisma migrate deploy` antes de `next build`.

### Datos que no se migran solos

La BD nueva empieza **vacía**. Tendrás que volver a configurar lo que vivía en Postgres:

- Cuentas **TikTok Ads** (`/tiktok/cuentas`) o `TIKTOK_ACCESS_TOKEN` + `TIKTOK_ADVERTISER_ID` en env
- **Productos**, campañas internas, historial **Informe IA**
- OAuth **Comentarios Meta**, chats del asistente, productos pendientes

**Sigue funcionando** sin migrar: dashboard **Meta** (solo API), archivos en **Vercel Blob**.

### Migrar datos de la BD vieja (opcional)

Si Neon antiguo aún permite conexión puntual:

```bash
pg_dump "$OLD_DATABASE_URL" --no-owner --no-acl -Fc -f backup.dump
pg_restore --no-owner --no-acl -d "$NEW_DATABASE_URL" backup.dump
```

Si la cuenta vieja está suspendida por cuota, contacta `support@neon.tech` para exportar o espera al reinicio del ciclo.
