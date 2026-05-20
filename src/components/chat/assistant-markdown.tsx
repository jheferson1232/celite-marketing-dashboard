"use client"

import { memo } from "react"
import { Streamdown } from "streamdown"
import "streamdown/styles.css"
import { cn } from "@/lib/utils"

interface AssistantMarkdownProps {
  content: string
  isAnimating: boolean
}

export const AssistantMarkdown = memo(function AssistantMarkdown({
  content,
  isAnimating,
}: AssistantMarkdownProps) {
  if (!content) return null

  return (
    <Streamdown
      className={cn(
        "streamdown-assistant text-sm leading-relaxed",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5",
        "[&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold",
        "[&_table]:my-3 [&_table]:w-full [&_table]:text-xs",
        "[&_th]:border-border [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
        "[&_td]:border-border [&_td]:border [&_td]:px-2 [&_td]:py-1",
        "[&_hr]:border-border [&_hr]:my-4"
      )}
      mode={isAnimating ? undefined : "static"}
      isAnimating={isAnimating}
      shikiTheme={["github-light", "github-dark"]}
    >
      {content}
    </Streamdown>
  )
})
