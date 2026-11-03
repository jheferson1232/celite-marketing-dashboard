"use client"

import * as React from "react"
import { RiArrowDownSLine, RiCheckLine, RiImageLine } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AdInsightRow } from "@/lib/services/meta/types"
import {
  type BufferPostLinkOption,
  bufferSelectionMatchesGroup,
  clearBufferAdSelectionLink,
  collectAdIdsFromInsightGroup,
  findLinkedBufferPostId,
  readBufferAdSelectionForPost,
  saveBufferAdSelection,
} from "@/lib/services/buffer/buffer-ad-selection"

function BufferPostThumbnail({
  post,
  selected,
  sameVideo,
  onSelect,
}: {
  post: BufferPostLinkOption
  selected: boolean
  sameVideo: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      title={post.text}
      className={`relative aspect-[9/16] w-full overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10 transition-[box-shadow,transform] hover:ring-foreground/20 active:scale-[0.98] ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onSelect}
    >
      {post.thumbnail ? (
        <img
          src={post.thumbnail}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center">
          <RiImageLine className="size-6 opacity-50" />
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-0.5 p-1">
        {sameVideo ? (
          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
            Mismo video
          </Badge>
        ) : null}
        {selected ? (
          <Badge className="h-4 gap-0.5 px-1 text-[9px]">
            <RiCheckLine className="size-2.5" />
            Vinculado
          </Badge>
        ) : null}
      </span>
    </button>
  )
}

export function BufferPostLinkMenu({
  bufferVideoId,
  group,
  posts,
  postsLoading,
  postsTruncated = false,
}: {
  bufferVideoId: string
  group: AdInsightRow[]
  posts: BufferPostLinkOption[]
  postsLoading: boolean
  postsTruncated?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [linkedPostId, setLinkedPostId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLinkedPostId(findLinkedBufferPostId(bufferVideoId, group))
  }, [bufferVideoId, group])

  const sortedPosts = React.useMemo(() => {
    return [...posts].sort((left, right) => {
      const leftSame = left.videoId === bufferVideoId ? 0 : 1
      const rightSame = right.videoId === bufferVideoId ? 0 : 1
      if (leftSame !== rightSame) return leftSame - rightSame
      return left.text.localeCompare(right.text, "es")
    })
  }, [posts, bufferVideoId])

  function linkPost(postId: string) {
    const { campaignIds, adgroupIds } = collectAdIdsFromInsightGroup(group)
    if (campaignIds.length === 0 && adgroupIds.length === 0) return
    saveBufferAdSelection({
      bufferPostId: postId,
      videoId: bufferVideoId,
      campaignIds,
      adgroupIds,
    })
    setLinkedPostId(postId)
    setOpen(false)
  }

  function unlinkPost() {
    clearBufferAdSelectionLink({
      bufferPostId: linkedPostId,
      videoId: bufferVideoId,
      group,
    })
    setLinkedPostId(null)
  }

  const isLinked =
    linkedPostId != null &&
    bufferSelectionMatchesGroup(
      readBufferAdSelectionForPost(linkedPostId, bufferVideoId),
      group
    )

  const linkedPost = linkedPostId
    ? posts.find((post) => post.id === linkedPostId)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={isLinked ? "secondary" : "outline"}
          size="sm"
          className="h-8 w-full gap-1 text-xs"
        >
          {isLinked ? (
            <>
              <RiCheckLine className="size-3.5 shrink-0" />
              <span className="truncate">En Buffer</span>
            </>
          ) : (
            <span className="truncate">Pasar a Buffer</span>
          )}
          <RiArrowDownSLine className="size-3.5 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(var(--radix-popover-trigger-width)*2+0.5rem),280px)] gap-2 p-2"
        align="start"
      >
        {postsLoading ? (
          <p className="text-muted-foreground px-1 py-2 text-xs">Cargando posts…</p>
        ) : sortedPosts.length === 0 ? (
          <p className="text-muted-foreground px-1 py-2 text-xs leading-snug">
            No hay posts de Buffer guardados. Abrí Buffer y pulsa Actualizar.
          </p>
        ) : (
          <>
            <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
              {sortedPosts.map((post) => {
                const selected =
                  isLinked &&
                  linkedPostId === post.id &&
                  bufferSelectionMatchesGroup(
                    readBufferAdSelectionForPost(post.id, bufferVideoId),
                    group
                  )
                const sameVideo = post.videoId === bufferVideoId
                return (
                  <li key={post.id}>
                    <BufferPostThumbnail
                      post={post}
                      selected={selected}
                      sameVideo={sameVideo}
                      onSelect={() => linkPost(post.id)}
                    />
                  </li>
                )
              })}
            </ul>
            {postsTruncated ? (
              <p className="text-muted-foreground px-0.5 text-[10px] leading-snug">
                Hay más posts en Buffer. En Buffer → Actualizar para traerlos
                todos.
              </p>
            ) : null}
          </>
        )}
        {isLinked ? (
          <div className="border-t pt-2 space-y-2">
            {linkedPost?.thumbnail ? (
              <img
                src={linkedPost.thumbnail}
                alt=""
                className="mx-auto aspect-[9/16] max-h-24 w-auto rounded-md object-cover ring-1 ring-foreground/10"
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={unlinkPost}
            >
              Desvincular
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
