"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import type { MetaCommentAgentSettingsInput } from "@/lib/services/meta/comments/agent-settings"
import {
  getMetaCommentAgentSettingsAction,
  updateMetaCommentAgentSettingsAction,
} from "../../_actions/meta-comments-config"

export function useMetaCommentAgentSettings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["meta-comment-agent-settings"],
    queryFn: () => runServerAction(getMetaCommentAgentSettingsAction()),
  })

  const mutation = useMutation({
    mutationFn: (input: MetaCommentAgentSettingsInput) =>
      runServerAction(updateMetaCommentAgentSettingsAction(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["meta-comment-agent-settings"],
      })
    },
  })

  return { query, mutation }
}
