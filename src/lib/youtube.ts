export type ChannelMetrics = {
  id: string
  title: string
  customUrl?: string
  publishedAt: string
  subscriberCount: number
  videoCount: number
  viewCount: number
}

type YouTubeChannelItem = {
  id: string
  snippet: {
    title: string
    customUrl?: string
    publishedAt: string
  }
  statistics: {
    subscriberCount: string
    videoCount: string
    viewCount: string
  }
}

const CHANNEL_ID_REGEX = /(?:youtube\.com\/channel\/)(UC[\w-]{22})/
const HANDLE_REGEX = /(?:youtube\.com\/)?@([A-Za-z0-9._-]+)/
const USERNAME_REGEX = /(?:youtube\.com\/user\/)([A-Za-z0-9._-]+)/

export type ChannelInput =
  | { kind: 'channelId'; value: string }
  | { kind: 'forHandle'; value: string }
  | { kind: 'forUsername'; value: string }

export function parseChannelInput(rawValue: string): ChannelInput | null {
  const value = rawValue.trim()
  if (!value) return null

  const channelIdMatch = value.match(CHANNEL_ID_REGEX)
  if (channelIdMatch) return { kind: 'channelId', value: channelIdMatch[1] }

  const handleMatch = value.match(HANDLE_REGEX)
  if (handleMatch) return { kind: 'forHandle', value: `@${handleMatch[1]}` }

  const usernameMatch = value.match(USERNAME_REGEX)
  if (usernameMatch) return { kind: 'forUsername', value: usernameMatch[1] }

  if (value.startsWith('@')) return { kind: 'forHandle', value }

  return { kind: 'forUsername', value }
}

async function fetchChannelsBy(input: ChannelInput, apiKey: string): Promise<YouTubeChannelItem[]> {
  const queryParam =
    input.kind === 'channelId'
      ? `id=${encodeURIComponent(input.value)}`
      : input.kind === 'forHandle'
        ? `forHandle=${encodeURIComponent(input.value)}`
        : `forUsername=${encodeURIComponent(input.value)}`

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${queryParam}&key=${apiKey}`
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`YouTube API request failed (${response.status}): ${text}`)
  }

  const payload = (await response.json()) as { items: YouTubeChannelItem[] }
  return payload.items ?? []
}

export async function fetchCompetitionMetrics(rawValues: string[], apiKey: string): Promise<ChannelMetrics[]> {
  const deduped = [...new Set(rawValues.map((value) => value.trim()).filter(Boolean))]
  const parsed = deduped.map(parseChannelInput).filter((item): item is ChannelInput => item !== null)

  const data = await Promise.all(parsed.map((item) => fetchChannelsBy(item, apiKey)))

  return data.flat().map((channel) => ({
    id: channel.id,
    title: channel.snippet.title,
    customUrl: channel.snippet.customUrl,
    publishedAt: channel.snippet.publishedAt,
    subscriberCount: Number(channel.statistics.subscriberCount ?? 0),
    videoCount: Number(channel.statistics.videoCount ?? 0),
    viewCount: Number(channel.statistics.viewCount ?? 0)
  }))
}
