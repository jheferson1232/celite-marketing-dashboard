import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { MetaCommentProductForm } from "../_components/product-form"

export const metadata = {
  title: "Nuevo producto · Comentarios IA",
}

export default function NewMetaCommentProductPage() {
  return (
    <AppPageScrollShell>
      <MetaCommentProductForm />
    </AppPageScrollShell>
  )
}
