import prisma from "@/lib/prisma"

export type MetaCommentAgentSettingsRecord = {
  country: string
  contactInfo: string | null
  shippingTime: string | null
  businessInfo: string | null
  deleteNegativeEnabled: boolean
  deletePrompt: string | null
  deleteExamplesRemove: string | null
  deleteExamplesKeep: string | null
  publicReplyEnabled: boolean
  publicReplyPrompt: string | null
  publicReplyIncludeLink: boolean
  publicReplyIncludePrice: boolean
  dmReplyEnabled: boolean
  dmReplyPrompt: string | null
  dmDataToCollect: string | null
  updatedAt: string
}

export type MetaCommentAgentSettingsInput = Partial<
  Omit<MetaCommentAgentSettingsRecord, "updatedAt">
>

const DEFAULT_DELETE_PROMPT = `Contexto: Publicamos un producto en un post de facebook y estamos revisando la calidad de los comentarios, para mantener solamente los comentarios buenos y eliminar todo comentario negativo
Comentario negativo: Cualquier comentario que afecte la reputación del producto o de la empresa o que establezca comparaciones negativas con otros productos
Misión: Identifica si el comentario o la pregunta del cliente es negativa o no.`

const DEFAULT_DELETE_EXAMPLES_REMOVE = `1. Groserías o insultos
2. Malas reseñas
3. Intentos de venta de otros productos`

const DEFAULT_DELETE_EXAMPLES_KEEP = `1. Preguntas sobre el precio o valor del producto
2. Preguntas sobre información del producto`

const DEFAULT_PUBLIC_REPLY_PROMPT = `Contexto: Actúa como un experto en community manager que responde los comentarios de los clientes de facebook e instagram de forma muy amigable y persuasiva. Tu objetivo es convertir comentarios en compras reales.
Misión: Responder el comentario del usuario de forma persuasiva para que el cliente decida comprar el producto.
Longitud: La respuesta debe tener máximo 30 palabras.`

const DEFAULT_DM_PROMPT = `MISIÓN: Vender {NOMBRE_PRODUCTO} con persuasión y calidez, sin inventar información. Usa únicamente lo que esté en {DESCRIPCION_PRODUCTO}. Evita sonar robótico: escribe como hablaría una persona real, con frases naturales, sin emojis y con llamados a la acción claros.`

const DEFAULT_DM_DATA =
  "Nombre; Dirección; Ciudad; Departamento; Número de teléfono; Productos escogidos; Valor de la compra"

function toRecord(row: {
  country: string
  contactInfo: string | null
  shippingTime: string | null
  businessInfo: string | null
  deleteNegativeEnabled: boolean
  deletePrompt: string | null
  deleteExamplesRemove: string | null
  deleteExamplesKeep: string | null
  publicReplyEnabled: boolean
  publicReplyPrompt: string | null
  publicReplyIncludeLink: boolean
  publicReplyIncludePrice: boolean
  dmReplyEnabled: boolean
  dmReplyPrompt: string | null
  dmDataToCollect: string | null
  updatedAt: Date
}): MetaCommentAgentSettingsRecord {
  return {
    country: row.country,
    contactInfo: row.contactInfo,
    shippingTime: row.shippingTime,
    businessInfo: row.businessInfo,
    deleteNegativeEnabled: row.deleteNegativeEnabled,
    deletePrompt: row.deletePrompt,
    deleteExamplesRemove: row.deleteExamplesRemove,
    deleteExamplesKeep: row.deleteExamplesKeep,
    publicReplyEnabled: row.publicReplyEnabled,
    publicReplyPrompt: row.publicReplyPrompt,
    publicReplyIncludeLink: row.publicReplyIncludeLink,
    publicReplyIncludePrice: row.publicReplyIncludePrice,
    dmReplyEnabled: row.dmReplyEnabled,
    dmReplyPrompt: row.dmReplyPrompt,
    dmDataToCollect: row.dmDataToCollect,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getOrCreateMetaCommentAgentSettings(): Promise<MetaCommentAgentSettingsRecord> {
  const row = await prisma.metaCommentAgentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      deletePrompt: DEFAULT_DELETE_PROMPT,
      deleteExamplesRemove: DEFAULT_DELETE_EXAMPLES_REMOVE,
      deleteExamplesKeep: DEFAULT_DELETE_EXAMPLES_KEEP,
      publicReplyPrompt: DEFAULT_PUBLIC_REPLY_PROMPT,
      dmReplyPrompt: DEFAULT_DM_PROMPT,
      dmDataToCollect: DEFAULT_DM_DATA,
    },
    update: {},
  })
  return toRecord(row)
}

export async function updateMetaCommentAgentSettings(
  input: MetaCommentAgentSettingsInput
): Promise<MetaCommentAgentSettingsRecord> {
  await getOrCreateMetaCommentAgentSettings()
  const row = await prisma.metaCommentAgentSettings.update({
    where: { id: "default" },
    data: {
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.contactInfo !== undefined
        ? { contactInfo: input.contactInfo }
        : {}),
      ...(input.shippingTime !== undefined
        ? { shippingTime: input.shippingTime }
        : {}),
      ...(input.businessInfo !== undefined
        ? { businessInfo: input.businessInfo }
        : {}),
      ...(input.deleteNegativeEnabled !== undefined
        ? { deleteNegativeEnabled: input.deleteNegativeEnabled }
        : {}),
      ...(input.deletePrompt !== undefined
        ? { deletePrompt: input.deletePrompt }
        : {}),
      ...(input.deleteExamplesRemove !== undefined
        ? { deleteExamplesRemove: input.deleteExamplesRemove }
        : {}),
      ...(input.deleteExamplesKeep !== undefined
        ? { deleteExamplesKeep: input.deleteExamplesKeep }
        : {}),
      ...(input.publicReplyEnabled !== undefined
        ? { publicReplyEnabled: input.publicReplyEnabled }
        : {}),
      ...(input.publicReplyPrompt !== undefined
        ? { publicReplyPrompt: input.publicReplyPrompt }
        : {}),
      ...(input.publicReplyIncludeLink !== undefined
        ? { publicReplyIncludeLink: input.publicReplyIncludeLink }
        : {}),
      ...(input.publicReplyIncludePrice !== undefined
        ? { publicReplyIncludePrice: input.publicReplyIncludePrice }
        : {}),
      ...(input.dmReplyEnabled !== undefined
        ? { dmReplyEnabled: input.dmReplyEnabled }
        : {}),
      ...(input.dmReplyPrompt !== undefined
        ? { dmReplyPrompt: input.dmReplyPrompt }
        : {}),
      ...(input.dmDataToCollect !== undefined
        ? { dmDataToCollect: input.dmDataToCollect }
        : {}),
    },
  })
  return toRecord(row)
}
