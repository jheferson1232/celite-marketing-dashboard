/** Serializa llamadas Meta para no superar ~9 QPS (límite típico: 10). */
const MIN_GAP_MS = 120

let chain: Promise<unknown> = Promise.resolve()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function pacedMetaRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    await sleep(MIN_GAP_MS)
    return fn()
  })
  chain = run.catch(() => undefined)
  return run
}
