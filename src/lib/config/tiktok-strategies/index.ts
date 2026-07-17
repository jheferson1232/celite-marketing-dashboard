import { ABO_STRATEGY } from "./abo"
import { CBO_STRATEGY } from "./cbo"
import type { TikTokStrategyDefinition, TikTokStrategyId } from "./types"

export * from "./types"
export * from "./validation"
export { ABO_STRATEGY } from "./abo"
export {
  CBO_ADGROUP_PRESETS,
  CBO_DEFAULT_PRESET_IDS,
  CBO_STRATEGY,
} from "./cbo"

const STRATEGIES: Record<TikTokStrategyId, TikTokStrategyDefinition> = {
  ABO: ABO_STRATEGY,
  CBO: CBO_STRATEGY,
}

export function getTikTokStrategy(id: TikTokStrategyId): TikTokStrategyDefinition {
  return STRATEGIES[id]
}

export function listTikTokStrategies(): TikTokStrategyDefinition[] {
  return Object.values(STRATEGIES)
}

export function isTikTokStrategyId(value: string): value is TikTokStrategyId {
  return value in STRATEGIES
}
