"use client"

import type { VisibilityState } from "@tanstack/react-table"
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/local-storage"
import { useState } from "react"

export const META_CAMPAIGNS_COLUMN_VISIBILITY_KEY =
  "dashboard:campaigns:column-visibility"

export const META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  impressions: false,
  totalSpend: false,
}

export const TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY =
  "dashboard:tiktok:campaigns:column-visibility"

/** Menos columnas visibles por defecto; el resto se activa en «Columnas». */
export const TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  impressions: false,
  totalSpend: false,
}

export function usePersistedColumnVisibility(
  storageKey = META_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  defaultVisibility: VisibilityState = {}
) {
  const [columnVisibility, _setColumnVisibility] = useState<VisibilityState>(
    () =>
      getLocalStorageItem<VisibilityState>(storageKey, defaultVisibility)
  )

  const setColumnVisibility = (visibility: VisibilityState) => {
    _setColumnVisibility(visibility)
    setLocalStorageItem(storageKey, visibility)
  }

  return {
    columnVisibility,
    setColumnVisibility,
  }
}
