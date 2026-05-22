# Base de datos para Vercel (asistente IA + Telegram)

El asistente en Meta/TikTok y el historial de chats usan **PostgreSQL** vía Prisma. `localhost` no funciona en Vercel.

## Configuración rápida con Neon

1. En [Vercel Dashboard](https://vercel.com) → tu proyecto → **Storage** → **Create Database** → **Neon**.
2. Conecta la base al proyecto `celite-marketing-dashboard`.
3. Vercel creará `DATABASE_URL` (y a veces `POSTGRES_URL`) en Environment Variables.
   - Si Neon te da URL con `-pooler` en el host, el build usa automáticamente la URL directa para `prisma migrate deploy`.
   - Opcional: añade `DIRECT_URL` con la conexión sin pooler (Neon → Connection string → **Direct**).
4. En tu máquina, con la URL de producción copiada:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   ```

5. **Redeploy** en Vercel (Deployments → Redeploy).

## Comprobar conexión local

```bash
npm run db:check
```

Si ves aviso de `localhost`, actualiza `.env` y las variables en Vercel antes de desplegar.
