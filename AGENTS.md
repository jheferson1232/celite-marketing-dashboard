# Convenciones de fetching

## Patrón obligatorio: Server Actions + React Query

Toda obtención de datos del servidor sigue este flujo:

### 1. Servicio (src/lib/services/)
- **Singleton funcional**: variable de módulo lazy-init, NO clases.
- Usar **axios** con instancia compartida vía `getClient()`.
- Exportar funciones puras: `export async function getX(...): Promise<T>`.

### 2. Server Action (archivo separado con 'use server')
- Envolver cada función del servicio con `createServerAction()` de `@/lib/create-server-action` (exige sesión antes de ejecutar).
- Nunca exportar una server action sin envolver: el proxy deja pasar las server actions y la sesión solo se valida en `createServerAction`. Las de formulario (`<form action>`) llaman `requireSessionOrRedirect()` de `@/lib/auth/server`.
- No poner lógica de negocio en la action, solo delegar al servicio.

### 3. Componente cliente
- Usar `useQuery` de `@tanstack/react-query`.
- `queryFn` siempre llama `runServerAction(miAction(args))`.
- `queryKey` debe incluir todos los parámetros que afectan el resultado.

## Prohibido
- Usar clases para servicios o singletons.
- Llamar APIs externas directamente desde componentes.
- Usar `fetch()` en vez de axios para servicios externos.
- Poner lógica de negocio dentro de server actions.

## Informe IA vs dashboard Meta (`/dashboard`)

- **No modificar** `src/app/(app)/dashboard/` ni servicios de listado/KPIs del dashboard al trabajar en Informe IA.
- Informe IA vive en `src/app/(app)/informe-ia/` y `meta-operative-service.ts` (+ `meta-account-daily-insights.ts`, `informe-entity-status.ts`). Setup: `docs/INFORME-IA.md`.
- Persistencia propia: `MetaTrackEntity` (catálogo), `MetaOperativeDay` (gasto/ventas/puntos/estado por entidad y día), `MetaInformeAccountDay` (totales cuenta por día). Al sincronizar se guarda cada día en orden cronológico.
- Cron 2×/día 8:00 y 20:00 Lima (Vercel Schedules en `vercel.json` → `src/app/crons/meta-telegram-reports/route.ts` → `meta-hourly-report.ts`): Telegram con conjuntos **ON** en Crítico. Botón «Enviar a Telegram» = mismo informe manual. Historial sync: 7 días (`META_INFORME_MAX_DAYS`).
- Caché Meta del informe con prefijo `meta-informe:`; no invalidar `clearMetaCache()` del dashboard.
- El informe **no** llama a `campaigns-list`, `campaign-adsets` ni al catálogo completo `meta:adsets:catalog` / `meta:campaigns:catalog` del dashboard.

## Autenticación

- Clave maestra única en `APP_PASSWORD` (sin usuarios ni tablas). Sin esa variable la app queda bloqueada.
- `src/proxy.ts` exige la cookie `celite_session` en todo salvo `/login`, `/crons/*` (CRON_SECRET, Vercel Schedules), `/api/telegram/webhook` (TELEGRAM_WEBHOOK_SECRET obligatorio) y `/api/health/*`.
- Una ruta pública nueva necesita su propio secreto y agregarse a `PUBLIC_PATHS`/`PUBLIC_PREFIXES` en `src/proxy.ts`.
