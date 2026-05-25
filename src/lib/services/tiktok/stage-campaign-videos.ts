import fs from "fs"
import os from "os"
import path from "path"
import { mapWithConcurrency } from "./concurrency"
import { fetchWithRetry } from "./fetch-with-retry"
import type { TikTokLaunchCampaignConfig } from "./launch-campaign-types"
import {
  launchProgressMessage,
  setLaunchProgress,
} from "./launch-progress"
import type { LaunchMetrics } from "./launch-metrics"
import type { StagedVideosDirectory } from "./stage-product-videos"

const STAGING_CONCURRENCY = 3

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80)
}

function isRemoteVideoUrl(value: string | undefined): value is string {
  if (!value?.trim()) return false
  return /^https?:\/\//i.test(value.trim())
}

type RemoteAdgroupTask = {
  index: number
  name: string
  videoUrl: string
}

/** Descarga videos remotos (Blob) de cada adgroup a archivos temporales locales. */
export async function stageCampaignAdgroupVideosFromBlob(
  adgroups: TikTokLaunchCampaignConfig["adgroups"],
  options: {
    campaignId?: string
    metrics?: LaunchMetrics
  } = {}
): Promise<{
  staged: StagedVideosDirectory
  adgroups: TikTokLaunchCampaignConfig["adgroups"]
}> {
  const remoteTasks: RemoteAdgroupTask[] = []
  for (let i = 0; i < adgroups.length; i++) {
    const ag = adgroups[i]!
    if (isRemoteVideoUrl(ag.video)) {
      remoteTasks.push({
        index: i,
        name: ag.name,
        videoUrl: ag.video.trim(),
      })
    }
  }

  if (remoteTasks.length === 0) {
    throw new Error("No hay videos remotos para descargar desde los creativos.")
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "celite-campaign-tiktok-"))
  const usedNames = new Set<string>()
  const stagedAdgroups = [...adgroups]

  const tasksWithPaths = remoteTasks.map((task) => {
    let filename = `${sanitizeFilename(task.name || `adgroup-${task.index + 1}`)}.mp4`
    let suffix = 2
    while (usedNames.has(filename)) {
      filename = `${sanitizeFilename(task.name || `adgroup-${task.index + 1}`)}-${suffix}.mp4`
      suffix++
    }
    usedNames.add(filename)
    return {
      ...task,
      localPath: path.join(dir, filename),
    }
  })

  let stagedCount = 0

  const stageOne = async (task: (typeof tasksWithPaths)[number]) => {
    if (options.campaignId) {
      const nextCount = stagedCount + 1
      setLaunchProgress(options.campaignId, {
        stage: "staging",
        current: nextCount,
        total: tasksWithPaths.length,
        message: launchProgressMessage(
          "staging",
          nextCount,
          tasksWithPaths.length
        ),
      })
    }

    const res = await fetchWithRetry(task.videoUrl, {}, {
      label: `descarga video "${task.name}"`,
      timeoutMs: 180_000,
    })
    if (!res.ok) {
      throw new Error(
        `No se pudo descargar el video "${task.name}" (${res.status})`
      )
    }

    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(task.localPath, buf)

    stagedAdgroups[task.index] = {
      ...adgroups[task.index]!,
      video: task.localPath,
    }
    stagedCount += 1
    if (options.metrics) {
      options.metrics.counters.videosStaged += 1
    }
  }

  const runStaging = async () => {
    await mapWithConcurrency(tasksWithPaths, STAGING_CONCURRENCY, stageOne)
  }

  if (options.metrics) {
    await options.metrics.time("staging", runStaging)
  } else {
    await runStaging()
  }

  return {
    staged: {
      dir,
      staged: true,
      cleanup: () => {
        try {
          fs.rmSync(dir, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
      },
    },
    adgroups: stagedAdgroups,
  }
}
