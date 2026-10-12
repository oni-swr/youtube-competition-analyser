# YouTube Competition Analyser

First feature: analyse competing channels by comparing:
- subscribers
- number of videos
- total views

## Stack
- React + Vite (dashboard foundation, can be migrated to TanStack Start router progressively)
- TanStack Table for rendering channel metrics
- YouTube Data API v3 for channel data
- Convex for persistent channel analysis results

## Caching
- Competitor metrics are cached per channel in browser storage for 24 hours, surviving reloads. Adding channels only fetches new or expired entries. Channel IDs and returned handles share cached results.
- Concurrent requests for the same browser cache entry share one fetch. Failed requests are not cached; unavailable browser storage falls back to memory.
- Channel analysis checks Convex first and reuses results for 24 hours. On a miss, the browser fetches the latest 50 videos using `VITE_YOUTUBE_API_KEY`, then saves the result to Convex. YouTube requests originate from your browser, so your IP restriction applies. No backend YouTube key is needed.
- Cached competitor analyses yield between batches to keep the browser responsive. Results show 50 channels per page; sorting applies across all channels.

## Run
1. `cp .env.example .env`
2. Add your YouTube API key into `.env`
3. `npm install`
4. `npm run dev`

Then paste channel links, `@handles`, or legacy usernames one per line.
