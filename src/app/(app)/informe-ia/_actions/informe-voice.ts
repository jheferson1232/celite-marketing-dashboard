"use server"

import { createServerAction } from "@/lib/server-action"
import { createInformeRealtimeClientSecret } from "@/lib/services/meta/meta-informe-voice"

/** Token efímero Realtime + snapshot del informe embebido en instructions. */
export const createInformeVoiceSessionAction = createServerAction(async () =>
  createInformeRealtimeClientSecret()
)
