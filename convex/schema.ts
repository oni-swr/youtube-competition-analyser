import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  channelAnalyses: defineTable({
    lookupKey: v.string(),
    requestedInput: v.string(),
    channelId: v.string(),
    channelTitle: v.string(),
    videos: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        thumbnailUrl: v.string(),
        publishedAt: v.string(),
        viewCount: v.number(),
        outlierScore: v.union(v.number(), v.null()),
        medianBaselineViews: v.union(v.number(), v.null()),
        format: v.union(v.literal("short"), v.literal("long"), v.literal("live")),
        durationSeconds: v.number(),
      }),
    ),
    fetchedAt: v.number(),
  }).index("by_lookupKey", ["lookupKey"]),
});
