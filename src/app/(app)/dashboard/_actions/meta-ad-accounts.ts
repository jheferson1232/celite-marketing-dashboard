"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listMetaAdAccounts,
  type MetaAdAccountSummary,
} from "@/lib/services/meta/meta-ad-accounts"

export const listMetaAdAccountsAction = createServerAction(
  async (): Promise<MetaAdAccountSummary[]> => listMetaAdAccounts()
)
