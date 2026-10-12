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
- Channel analysis uses the Convex cache for 24 hours before refreshing. The standalone browser video helper also caches results for 24 hours.

## Run
1. `cp .env.example .env`
2. Add your YouTube API key into `.env`
3. `npm install`
4. `npm run dev`

Then paste channel links, `@handles`, or legacy usernames one per line.
