"use client"

import type { VisibilityState } from "@tanstack/react-table"
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/local-storage"
import { useState } from "react"

export const META_CAMPAIGNS_COLUMN_VISIBILITY_KEY =
  "dashboard:campaigns:column-visibility:v2"

/**
 * Vista por defecto (ventas / CPA), igual que al filtrar conversiones:
 * Campaña, Gasto, conjuntos, Compras, CPA, Ventas 7d, CPA 7d, Total ventas, CPA total.
 * Al filtrar «mensajes» se cambia a leads/CPL.
 */
export const META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  impressions: false,
  ctr: false,
  cpc: false,
  leads: false,
  costPerLead: false,
  results: true,
  costPerResult: true,
  purchases7d: true,
  cpa7d: true,
  totalPurchases: true,
  totalSpend: false,
  totalCpa: true,
}

/**
 * Columnas al filtrar campañas de mensajes:
 * Campaña, Gasto, conjuntos, CTR/CPC + clientes potenciales / CPL.
 */
export const META_CAMPAIGNS_MESSAGES_COLUMN_VISIBILITY: VisibilityState = {
  impressions: false,
  ctr: true,
  cpc: true,
  results: false,
  costPerResult: false,
  purchases7d: false,
  cpa7d: false,
  totalPurchases: false,
  totalSpend: false,
  totalCpa: false,
  roas: false,
  leads: true,
  costPerLead: true,
}

/** Columnas al filtrar campañas de conversiones (compras / CPA). */
export const META_CAMPAIGNS_CONVERSIONS_COLUMN_VISIBILITY: VisibilityState = {
  ...META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
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
    () => ({
      ...defaultVisibility,
      ...getLocalStorageItem<VisibilityState>(storageKey, {}),
    })
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
