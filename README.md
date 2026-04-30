# YouTube Competition Analyser

First feature: analyse competing channels by comparing:
- subscribers
- number of videos
- total views

## Stack
- React + Vite (dashboard foundation, can be migrated to TanStack Start router progressively)
- TanStack Table for rendering channel metrics
- YouTube Data API v3 for channel data
- Convex planned for persistence/history in next iteration

## Run
1. `cp .env.example .env`
2. Add your YouTube API key into `.env`
3. `npm install`
4. `npm run dev`

Then paste channel links, `@handles`, or legacy usernames one per line.
