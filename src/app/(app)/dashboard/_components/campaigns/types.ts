export type ColumnTextAlign = "left" | "right"

export interface CampaignColumnMeta {
  label: string
  align?: ColumnTextAlign
}

export type CampaignPerformanceStatus =
  | "EXCELENTE"
  | "EN_CURSO"
  | "CRITICO"
  | "APAGADO"

export type CampaignPerformanceFilter = "ALL" | CampaignPerformanceStatus
