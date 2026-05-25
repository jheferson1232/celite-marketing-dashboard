import { ABO_STRATEGY } from "./abo"
import type { TikTokStrategyDefinition, TikTokStrategyId } from "./types"

export * from "./types"
export * from "./validation"
export { ABO_STRATEGY } from "./abo"

const STRATEGIES: Record<TikTokStrategyId, TikTokStrategyDefinition> = {
  ABO: ABO_STRATEGY,
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
