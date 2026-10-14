import { fetchChannelVideos, parseChannelInput, type ChannelAnalysisResult } from './youtube'
import { CACHE_TTL_MS } from './youtubeCache'

type SavedAnalysis = ChannelAnalysisResult & { lookupKey: string; requestedInput: string }
type AnalysisCache = {
  get: (lookupKey: string) => Promise<ChannelAnalysisResult | null>
  save: (analysis: SavedAnalysis) => Promise<unknown>
}

export async function loadChannelAnalysis(
  rawInput: string,
  apiKey: string | undefined,
  cache: AnalysisCache,
  fetchVideos = fetchChannelVideos
): Promise<ChannelAnalysisResult> {
  const parsed = parseChannelInput(rawInput)
  if (!parsed) throw new Error('Please provide a valid channel URL, handle, or username.')
  const lookupKey = `${parsed.kind}:${parsed.kind === 'channelId' ? parsed.value : parsed.value.toLowerCase()}`
  const cached = await cache.get(lookupKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached
  if (!apiKey) throw new Error('Missing VITE_YOUTUBE_API_KEY in your .env file')
  const result = await fetchVideos(rawInput, apiKey)
  await cache.save({ ...result, lookupKey, requestedInput: rawInput })
  // Clicking the same channel in the competitor table uses its canonical ID.
  const canonicalKey = `channelId:${result.channelId}`
  if (canonicalKey !== lookupKey) {
    await cache.save({ ...result, lookupKey: canonicalKey, requestedInput: rawInput })
  }
  return result
}
