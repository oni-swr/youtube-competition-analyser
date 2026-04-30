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
    const existing = await ctx.db
      .query("channelAnalyses")
      .withIndex("by_lookupKey", (q) => q.eq("lookupKey", args.lookupKey))
      .unique();

    const payload = {
      ...args,
      fetchedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("channelAnalyses", payload);
  },
});
