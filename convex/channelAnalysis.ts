import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByLookupKey = query({
  args: { lookupKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channelAnalyses")
      .withIndex("by_lookupKey", (q) => q.eq("lookupKey", args.lookupKey))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    lookupKey: v.string(),
    requestedInput: v.string(),
    channelId: v.string(),
    channelTitle: v.string(),
    fetchedAt: v.optional(v.number()),
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
  },
  handler: async (ctx, args) => {
    if (args.videos.length > 50) throw new Error("Analysis supports at most 50 videos.");
    const existing = await ctx.db
      .query("channelAnalyses")
      .withIndex("by_lookupKey", (q) => q.eq("lookupKey", args.lookupKey))
      .unique();

    const payload = {
      ...args,
      // Preserve the original browser fetch time instead of extending the TTL
      // when a locally cached result is copied into Convex.
      fetchedAt: Math.min(args.fetchedAt ?? Date.now(), Date.now()),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("channelAnalyses", payload);
  },
});
