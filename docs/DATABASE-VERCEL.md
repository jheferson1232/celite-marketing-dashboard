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
npm run db:check
```

Si ves aviso de `localhost`, actualiza `.env` y las variables en Vercel antes de desplegar.
