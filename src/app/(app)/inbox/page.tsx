import { redirect } from "next/navigation"

export default function InboxPage() {
  redirect("/dashboard?assistant=true")
}
