import { bufferQuery } from "./buffer-client"

export const BUFFER_POST_STATUSES = [
  "scheduled",
  "sent",
  "draft",
  "error",
  "needs_approval",
  "sending",
] as const

export type BufferPostStatus = (typeof BUFFER_POST_STATUSES)[number]

export type BufferAccount = {
  id: string
  name: string | null
  timezone: string | null
}

export type BufferOrganization = {
  id: string
  name: string
  channelCount: number
}

export type BufferChannel = {
  id: string
  name: string
  displayName: string | null
  service: string
  type: string
  descriptor: string
  avatar: string
  externalLink: string | null
  isDisconnected: boolean
  isLocked: boolean
  isQueuePaused: boolean
  timezone: string
}

export type BufferPostAsset = {
  thumbnail: string
  type: string
  mimeType: string
}

export type BufferPost = {
  id: string
  text: string
  status: BufferPostStatus
  dueAt: string | null
  sentAt: string | null
  createdAt: string
  channelId: string
  channelService: string
  externalLink: string | null
  shareMode: string
  assets: BufferPostAsset[]
  errorMessage: string | null
}

export type BufferBoard = {
  account: BufferAccount
  organizations: BufferOrganization[]
  channels: BufferChannel[]
  posts: BufferPost[]
  hasMorePosts: boolean
}

const POST_LIMIT = 100
const MAX_POST_PAGES = 20

const POST_NODE_FIELDS = `
  id
  text
  status
  dueAt
  sentAt
  createdAt
  channelId
  channelService
  externalLink
  shareMode
  assets {
    thumbnail
    type
    mimeType
  }
  error {
    message
  }
`

let cachedOrganizationId: string | null = null

const OVERVIEW_QUERY = `
  query BufferOverview {
    account {
      id
      name
      timezone
      organizations {
        id
        name
        channelCount
      }
    }
  }
`

const BOARD_QUERY = `
  query BufferBoard($organizationId: OrganizationId!) {
    account {
      id
      name
      timezone
      organizations {
        id
        name
        channelCount
      }
    }
    channels(input: { organizationId: $organizationId }) {
      id
      name
      displayName
      service
      type
      descriptor
      avatar
      externalLink
      isDisconnected
      isLocked
      isQueuePaused
      timezone
    }
    posts(
      first: ${POST_LIMIT}
      input: {
        organizationId: $organizationId
        sort: [{ field: createdAt, direction: desc }]
      }
    ) {
      edges {
        cursor
        node {
          ${POST_NODE_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

const POSTS_PAGE_QUERY = `
  query BufferPostsPage($organizationId: OrganizationId!, $after: String) {
    posts(
      first: ${POST_LIMIT}
      after: $after
      input: {
        organizationId: $organizationId
        sort: [{ field: createdAt, direction: desc }]
      }
    ) {
      edges {
        cursor
        node {
          ${POST_NODE_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

type OverviewData = {
  account: {
    id: string
    name: string | null
    timezone: string | null
    organizations: BufferOrganization[]
  }
}

type BufferPostNode = {
  id: string
  text: string
  status: BufferPostStatus
  dueAt: string | null
  sentAt: string | null
  createdAt: string
  channelId: string
  channelService: string
  externalLink: string | null
  shareMode: string
  assets: BufferPostAsset[]
  error: { message: string } | null
}

type PostsConnection = {
  edges: Array<{ cursor: string; node: BufferPostNode }> | null
  pageInfo: {
    hasNextPage: boolean
    endCursor?: string | null
  }
}

type BoardData = OverviewData & {
  channels: BufferChannel[]
  posts: PostsConnection
}

type PostsPageData = {
  posts: PostsConnection
}

function mapPostNode(node: BufferPostNode): BufferPost {
  return {
    id: node.id,
    text: node.text,
    status: node.status,
    dueAt: node.dueAt,
    sentAt: node.sentAt,
    createdAt: node.createdAt,
    channelId: node.channelId,
    channelService: node.channelService,
    externalLink: node.externalLink,
    shareMode: node.shareMode,
    assets: node.assets,
    errorMessage: node.error?.message ?? null,
  }
}

function mapPostsConnection(connection: PostsConnection): BufferPost[] {
  return (connection.edges ?? []).map((edge) => mapPostNode(edge.node))
}

async function fetchAllBoardPosts(
  organizationId: string,
  firstPage: PostsConnection
): Promise<{ posts: BufferPost[]; hasMorePosts: boolean }> {
  const posts = mapPostsConnection(firstPage)
  let hasMorePosts = firstPage.pageInfo.hasNextPage
  let after =
    firstPage.pageInfo.endCursor ??
    firstPage.edges?.at(-1)?.cursor ??
    null

  for (
    let page = 1;
    page < MAX_POST_PAGES && hasMorePosts && after;
    page += 1
  ) {
    const data = await bufferQuery<PostsPageData>(POSTS_PAGE_QUERY, {
      organizationId,
      after,
    })
    const connection = data.posts
    posts.push(...mapPostsConnection(connection))
    hasMorePosts = connection.pageInfo.hasNextPage
    after =
      connection.pageInfo.endCursor ?? connection.edges?.at(-1)?.cursor ?? null
    if ((connection.edges ?? []).length === 0) break
  }

  return { posts, hasMorePosts }
}

function mapBoard(
  data: BoardData,
  allPosts: BufferPost[],
  hasMorePosts: boolean
): BufferBoard {
  return {
    account: {
      id: data.account.id,
      name: data.account.name,
      timezone: data.account.timezone,
    },
    organizations: data.account.organizations,
    channels: data.channels,
    posts: allPosts,
    hasMorePosts,
  }
}

export async function getBufferBoard(
  organizationId?: string | null
): Promise<BufferBoard> {
  let resolvedOrganizationId = organizationId || cachedOrganizationId

  if (!resolvedOrganizationId) {
    const accountData = await bufferQuery<OverviewData>(OVERVIEW_QUERY)
    resolvedOrganizationId = accountData.account.organizations[0]?.id ?? null
    if (!resolvedOrganizationId) {
      return {
        account: {
          id: accountData.account.id,
          name: accountData.account.name,
          timezone: accountData.account.timezone,
        },
        organizations: accountData.account.organizations,
        channels: [],
        posts: [],
        hasMorePosts: false,
      }
    }
  }

  cachedOrganizationId = resolvedOrganizationId
  const data = await bufferQuery<BoardData>(BOARD_QUERY, {
    organizationId: resolvedOrganizationId,
  })
  const { posts, hasMorePosts } = await fetchAllBoardPosts(
    resolvedOrganizationId,
    data.posts
  )
  return mapBoard(data, posts, hasMorePosts)
}
