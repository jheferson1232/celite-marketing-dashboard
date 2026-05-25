/**
 * Validación local de utilidades del pipeline de lanzamiento TikTok.
 * Ejecutar: node scripts/bench-tiktok-launch.mjs
 */
import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"

async function mapWithConcurrency(items, concurrency, fn) {
  if (items.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

async function bench(label, fn) {
  const start = performance.now()
  const result = await fn()
  const durationMs = Math.round(performance.now() - start)
  console.log(`${label}: ${durationMs}ms`)
  return { result, durationMs }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function simulateSequential(count, stepMs) {
  for (let i = 0; i < count; i++) {
    await sleep(stepMs)
  }
}

async function simulateParallel(count, stepMs, concurrency) {
  await mapWithConcurrency(Array.from({ length: count }), concurrency, async () => {
    await sleep(stepMs)
  })
}

const adgroups = 6
const stepMs = 120

const sequential = await bench(
  `Secuencial (${adgroups} pasos x ${stepMs}ms)`,
  () => simulateSequential(adgroups, stepMs)
)

const parallel = await bench(
  `Paralelo (${adgroups} pasos, concurrencia 3)`,
  () => simulateParallel(adgroups, stepMs, 3)
)

const improvement =
  sequential.durationMs > 0
    ? Math.round((1 - parallel.durationMs / sequential.durationMs) * 100)
    : 0

console.log(`Mejora estimada en fase paralelizable: ${improvement}%`)

assert.equal(
  (await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 2)).join(","),
  "2,4,6"
)

console.log("bench-tiktok-launch: OK")
