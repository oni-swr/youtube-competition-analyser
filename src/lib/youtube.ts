export type ChannelMetrics = {
  id: string
  title: string
  customUrl?: string
  publishedAt: string
  subscriberCount: number
  videoCount: number
  viewCount: number
}

export type ChannelVideo = {
  id: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  viewCount: number
  outlierScore: number | null
  medianBaselineViews: number | null
  format: 'short' | 'long'
  durationSeconds: number
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

type YouTubeSearchItem = {
  id: { videoId?: string }
  snippet: {
    title: string
    publishedAt: string
    thumbnails?: {
      high?: { url: string }
      medium?: { url: string }
      default?: { url: string }
    }
  }
}

type YouTubeVideoItem = {
  id: string
  statistics?: {
    viewCount?: string
  }
  contentDetails?: {
    duration?: string
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


function parseIsoDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export async function fetchChannelVideos(rawValue: string, apiKey: string): Promise<{ channelTitle: string; videos: ChannelVideo[] }> {
  const parsed = parseChannelInput(rawValue)
  if (!parsed) throw new Error('Please provide a valid channel URL, handle, or username.')

  const channels = await fetchChannelsBy(parsed, apiKey)
  const channel = channels[0]
  if (!channel) throw new Error('Channel not found.')

  const videoItems: YouTubeSearchItem[] = []
  let nextPageToken: string | undefined

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId: channel.id,
      type: 'video',
      maxResults: '50',
      order: 'date',
      key: apiKey
    })
    if (nextPageToken) params.set('pageToken', nextPageToken)

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`YouTube API search request failed (${response.status}): ${text}`)
    }

    const payload = (await response.json()) as { items?: YouTubeSearchItem[]; nextPageToken?: string }
    videoItems.push(...(payload.items ?? []))
    nextPageToken = payload.nextPageToken
  } while (nextPageToken)

  const ids = videoItems.map((item) => item.id.videoId).filter((id): id is string => Boolean(id))
  const viewsById = new Map<string, number>()
  const durationById = new Map<string, number>()

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const params = new URLSearchParams({
      part: 'statistics,contentDetails',
      id: chunk.join(','),
      key: apiKey
    })
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`YouTube API videos request failed (${response.status}): ${text}`)
    }
    const payload = (await response.json()) as { items?: YouTubeVideoItem[] }
    for (const item of payload.items ?? []) {
      viewsById.set(item.id, Number(item.statistics?.viewCount ?? 0))
      durationById.set(item.id, parseIsoDurationToSeconds(item.contentDetails?.duration))
    }
  }

  const chronological = videoItems
    .map((item) => {
      const id = item.id.videoId
      if (!id) return null
      return {
        id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
        viewCount: viewsById.get(id) ?? 0,
        durationSeconds: durationById.get(id) ?? 0,
        format: (durationById.get(id) ?? 0) <= 60 ? 'short' as const : 'long' as const
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())

  const pastViewsByFormat: Record<'short' | 'long', number[]> = { short: [], long: [] }
  const withScores = chronological.map((video) => {
    const history = pastViewsByFormat[video.format]
    const median = computeMedian(history)
    const outlierScore = median && median > 0 ? video.viewCount / median : null
    history.push(video.viewCount)
    return { ...video, outlierScore, medianBaselineViews: median }
  })

  return { channelTitle: channel.snippet.title, videos: withScores }
}
