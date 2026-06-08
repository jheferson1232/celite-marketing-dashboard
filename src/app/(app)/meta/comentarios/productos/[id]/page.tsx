import { notFound } from "next/navigation"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { getMetaCommentProduct } from "@/lib/services/meta/comments/products"
import { MetaCommentProductForm } from "../_components/product-form"

export const metadata = {
  title: "Editar producto · Comentarios IA",
}

export default async function EditMetaCommentProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getMetaCommentProduct(id)
  if (!product) notFound()

  return (
    <AppPageScrollShell>
      <MetaCommentProductForm initial={product} />
    </AppPageScrollShell>
  )
}
