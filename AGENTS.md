# Convenciones de fetching

## Patrón obligatorio: Server Actions + React Query

Toda obtención de datos del servidor sigue este flujo:

### 1. Servicio (src/lib/services/)
- **Singleton funcional**: variable de módulo lazy-init, NO clases.
- Usar **axios** con instancia compartida vía `getClient()`.
- Exportar funciones puras: `export async function getX(...): Promise<T>`.

### 2. Server Action (archivo separado con 'use server')
- Envolver cada función del servicio con `createServerAction()` de `@/lib/server-action`.
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
