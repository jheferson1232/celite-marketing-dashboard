import { redirect } from "next/navigation"

interface ChatPageProps {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params
  redirect(`/dashboard?chat=${id}&assistant=true`)
}
