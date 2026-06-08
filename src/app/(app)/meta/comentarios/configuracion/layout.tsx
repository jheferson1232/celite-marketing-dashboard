import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { MetaCommentsConfigShell } from "./_components/config-shell"

export default function MetaCommentsConfigLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppPageScrollShell>
      <MetaCommentsConfigShell>{children}</MetaCommentsConfigShell>
    </AppPageScrollShell>
  )
}
