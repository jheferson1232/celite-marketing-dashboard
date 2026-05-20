"use client"

import type { VisibilityState } from "@tanstack/react-table"
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/local-storage"
import { useState } from "react"

const COLUMN_VISIBILITY_STORAGE_KEY =
  "dashboard:campaigns:column-visibility"

export function usePersistedColumnVisibility() {
  const [columnVisibility, _setColumnVisibility] = useState<VisibilityState>(
    () =>
      getLocalStorageItem<VisibilityState>(COLUMN_VISIBILITY_STORAGE_KEY, {})
  )

  const setColumnVisibility = (visibility: VisibilityState) => {
    _setColumnVisibility(visibility)
    setLocalStorageItem(COLUMN_VISIBILITY_STORAGE_KEY, visibility)
  }

  return {
    columnVisibility,
    setColumnVisibility,
  }
}
