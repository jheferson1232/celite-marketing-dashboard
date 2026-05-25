export type LaunchMetricStage =
  | "preflight"
  | "staging"
  | "resolve_campaign"
  | "prefetch_library"
  | "resolve_videos"
  | "resolve_covers"
  | "create_adgroups"
  | "enable_campaign"
  | "update_status"
  | "total"

export type LaunchMetricEntry = {
  stage: LaunchMetricStage
  durationMs: number
}

export type LaunchMetricCounters = {
  adgroupsTotal: number
  videosStaged: number
  videoCacheHits: number
  coverCacheHits: number
  libraryPrefetchHits: number
  retries: number
  coverPollAttempts: number
}

export class LaunchMetrics {
  private readonly startedAt = performance.now()
  private readonly entries: LaunchMetricEntry[] = []
  readonly counters: LaunchMetricCounters = {
    adgroupsTotal: 0,
    videosStaged: 0,
    videoCacheHits: 0,
    coverCacheHits: 0,
    libraryPrefetchHits: 0,
    retries: 0,
    coverPollAttempts: 0,
  }

  async time<T>(stage: LaunchMetricStage, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      return await fn()
    } finally {
      this.entries.push({
        stage,
        durationMs: Math.round(performance.now() - start),
      })
    }
  }

  finish(): LaunchMetricsSnapshot {
    const totalMs = Math.round(performance.now() - this.startedAt)
    this.entries.push({ stage: "total", durationMs: totalMs })
    return {
      totalMs,
      entries: [...this.entries],
      counters: { ...this.counters },
    }
  }
}

export type LaunchMetricsSnapshot = {
  totalMs: number
  entries: LaunchMetricEntry[]
  counters: LaunchMetricCounters
}

export function logLaunchMetrics(
  scope: string,
  snapshot: LaunchMetricsSnapshot
): void {
  console.info(`[tiktok-launch:${scope}]`, {
    totalMs: snapshot.totalMs,
    stages: Object.fromEntries(
      snapshot.entries.map((entry) => [entry.stage, entry.durationMs])
    ),
    counters: snapshot.counters,
  })
}
