/** Serializa operaciones pesadas de Meta para no disparar el límite por paralelismo. */
let chain: Promise<unknown> = Promise.resolve()

export function runMetaRequestQueued<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}
