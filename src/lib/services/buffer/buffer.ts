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

const POST_LIMIT = 60

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
        node {
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
        }
      }
      pageInfo {
        hasNextPage
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

type BoardData = OverviewData & {
  channels: BufferChannel[]
  posts: {
    edges: Array<{
      node: {
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
    }> | null
    pageInfo: {
      hasNextPage: boolean
    }
  }
}

function mapBoard(data: BoardData): BufferBoard {
  return {
    account: {
      id: data.account.id,
      name: data.account.name,
      timezone: data.account.timezone,
    },
    organizations: data.account.organizations,
    channels: data.channels,
    posts: (data.posts.edges ?? []).map((edge) => ({
      id: edge.node.id,
      text: edge.node.text,
      status: edge.node.status,
      dueAt: edge.node.dueAt,
      sentAt: edge.node.sentAt,
      createdAt: edge.node.createdAt,
      channelId: edge.node.channelId,
      channelService: edge.node.channelService,
      externalLink: edge.node.externalLink,
      shareMode: edge.node.shareMode,
      assets: edge.node.assets,
      errorMessage: edge.node.error?.message ?? null,
    })),
    hasMorePosts: data.posts.pageInfo.hasNextPage,
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
  return mapBoard(data)
}
