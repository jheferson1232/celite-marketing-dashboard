"use client"

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs"

export function useAssistantPanel() {
  return useQueryStates(
    {
      chat: parseAsString,
      assistant: parseAsBoolean.withDefault(false),
    },
    { shallow: false }
  )
}
