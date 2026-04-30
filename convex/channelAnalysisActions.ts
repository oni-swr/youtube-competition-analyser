"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const CHANNEL_ID_REGEX = /(?:youtube\.com\/channel\/)(UC[\w-]{22})/;
const HANDLE_REGEX = /(?:youtube\.com\/)?@([A-Za-z0-9._-]+)/;
const USERNAME_REGEX = /(?:youtube\.com\/user\/)([A-Za-z0-9._-]+)/;

type ChannelInput =
  | { kind: "channelId"; value: string }
  | { kind: "forHandle"; value: string }
  | { kind: "forUsername"; value: string };

type ChannelVideo = {
  id: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  outlierScore: number | null;
  medianBaselineViews: number | null;
  format: "short" | "long" | "live";
  durationSeconds: number;
};

type YouTubeChannelItem = {
  id: string;
  snippet: { title: string };
};

type YouTubeSearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
};

function parseChannelInput(rawValue: string): ChannelInput | null {
  const value = rawValue.trim();
  if (!value) return null;
  const channelIdMatch = value.match(CHANNEL_ID_REGEX);
  if (channelIdMatch) return { kind: "channelId", value: channelIdMatch[1] };
  const handleMatch = value.match(HANDLE_REGEX);
  if (handleMatch) return { kind: "forHandle", value: `@${handleMatch[1]}` };
  const usernameMatch = value.match(USERNAME_REGEX);
  if (usernameMatch) return { kind: "forUsername", value: usernameMatch[1] };
  if (value.startsWith("@")) return { kind: "forHandle", value };
  return { kind: "forUsername", value };
}

function lookupKeyFor(input: ChannelInput): string {
  return `${input.kind}:${input.value.toLowerCase()}`;
}

async function fetchChannelsBy(input: ChannelInput, apiKey: string): Promise<YouTubeChannelItem[]> {
  const queryParam =
    input.kind === "channelId"
      ? `id=${encodeURIComponent(input.value)}`
      : input.kind === "forHandle"
        ? `forHandle=${encodeURIComponent(input.value)}`
        : `forUsername=${encodeURIComponent(input.value)}`;

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&${queryParam}&key=${apiKey}`);
  if (!response.ok) throw new Error(`YouTube API channels request failed (${response.status})`);
  const payload = (await response.json()) as { items?: YouTubeChannelItem[] };
  return payload.items ?? [];
}

function parseIsoDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export const getOrFetchAnalysis = action({
  args: { rawInput: v.string() },
  handler: async (ctx, args) => {
    const parsed = parseChannelInput(args.rawInput);
    if (!parsed) throw new Error("Please provide a valid channel URL, handle, or username.");

    const key = lookupKeyFor(parsed);
    const cached = await ctx.runQuery(api.channelAnalysis.getByLookupKey, { lookupKey: key });
    if (cached) {
      return { channelTitle: cached.channelTitle, videos: cached.videos, source: "cache" as const };
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY for Convex action.");

    const channels = await fetchChannelsBy(parsed, apiKey);
    const channel = channels[0];
    if (!channel) throw new Error("Channel not found.");

    const search = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&type=video&maxResults=50&order=date&key=${apiKey}`);
    if (!search.ok) throw new Error(`YouTube API search request failed (${search.status})`);
    const searchPayload = (await search.json()) as { items?: YouTubeSearchItem[] };
    const videoItems = searchPayload.items ?? [];

    const ids = videoItems.map((item) => item.id.videoId).filter((id): id is string => Boolean(id));
    const details = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,player,liveStreamingDetails&id=${ids.join(",")}&key=${apiKey}`);
    if (!details.ok) throw new Error(`YouTube API videos request failed (${details.status})`);
    const detailPayload = (await details.json()) as { items?: Array<{ id: string; statistics?: { viewCount?: string }; contentDetails?: { duration?: string }; player?: { embedHtml?: string }; liveStreamingDetails?: { actualStartTime?: string; scheduledStartTime?: string } }> };

    const viewsById = new Map<string, number>();
    const durationById = new Map<string, number>();
    const shortsById = new Map<string, boolean>();
    const livestreamById = new Map<string, boolean>();

    for (const item of detailPayload.items ?? []) {
      viewsById.set(item.id, Number(item.statistics?.viewCount ?? 0));
      durationById.set(item.id, parseIsoDurationToSeconds(item.contentDetails?.duration));
      shortsById.set(item.id, (item.player?.embedHtml ?? "").includes("/shorts/"));
      livestreamById.set(item.id, Boolean(item.liveStreamingDetails?.actualStartTime || item.liveStreamingDetails?.scheduledStartTime));
    }

    const chronological = videoItems
      .map((item) => {
        const id = item.id.videoId;
        if (!id) return null;
        return {
          id,
          title: item.snippet.title,
          publishedAt: item.snippet.publishedAt,
          thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
          viewCount: viewsById.get(id) ?? 0,
          durationSeconds: durationById.get(id) ?? 0,
          format: livestreamById.get(id) ? "live" : (shortsById.get(id) ?? ((durationById.get(id) ?? 0) <= 60)) ? "short" : "long",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

    const pastViewsByFormat: Record<"short" | "long" | "live", number[]> = { short: [], long: [], live: [] };
    const videos: ChannelVideo[] = chronological.map((video) => {
      const history = pastViewsByFormat[video.format];
      const median = computeMedian(history);
      const outlierScore = median && median > 0 ? video.viewCount / median : null;
      history.push(video.viewCount);
      return { ...video, outlierScore, medianBaselineViews: median };
    });

    await ctx.runMutation(api.channelAnalysis.upsert, {
      lookupKey: key,
      requestedInput: args.rawInput,
      channelId: channel.id,
      channelTitle: channel.snippet.title,
      videos,
    });

    return { channelTitle: channel.snippet.title, videos, source: "api" as const };
  },
});
