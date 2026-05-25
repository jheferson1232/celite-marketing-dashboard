const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 2_000
const DEFAULT_TIMEOUT_MS = 120_000

export type FetchWithRetryOptions = {
  maxRetries?: number
  retryDelayMs?: number
  timeoutMs?: number
  label?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function isRetryableTikTokCode(code: number | undefined): boolean {
  return code === 40100 || code === 40101
}

function mergeAbortSignals(
  signalA: AbortSignal,
  signalB: AbortSignal
): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signalA, signalB])
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signalA.aborted || signalB.aborted) {
    controller.abort()
    return controller.signal
  }
  signalA.addEventListener("abort", abort)
  signalB.addEventListener("abort", abort)
  return controller.signal
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const label = options.label ?? "fetch"

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
    const signal = init.signal
      ? mergeAbortSignals(init.signal, timeoutController.signal)
      : timeoutController.signal

    try {
      const res = await fetch(input, { ...init, signal })
      clearTimeout(timeoutId)

      if (isRetryableStatus(res.status) && attempt < maxRetries) {
        await sleep(retryDelayMs * (attempt + 1))
        continue
      }

      return res
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error
      if (attempt >= maxRetries) break
      await sleep(retryDelayMs * (attempt + 1))
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label}: falló tras ${maxRetries + 1} intentos`)
}

export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {}
): Promise<{ response: Response; json: T }> {
  const response = await fetchWithRetry(input, init, options)
  const json = (await response.json()) as T
  return { response, json }
}

export async function postTikTokMultipartWithRetry<T extends { code: number; message: string }>(
  url: string,
  body: FormData,
  token: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const label = options.label ?? "TikTok upload"

  let lastMessage = label

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { json } = await fetchJsonWithRetry<T>(
      url,
      {
        method: "POST",
        headers: { "Access-Token": token },
        body,
      },
      { ...options, label }
    )

    if (json.code === 0) return json

    lastMessage = `${label}: ${json.code} — ${json.message}`
    if (!isRetryableTikTokCode(json.code) || attempt >= maxRetries) {
      throw new Error(lastMessage)
    }

    await sleep(retryDelayMs * (attempt + 1))
  }

  throw new Error(lastMessage)
}
