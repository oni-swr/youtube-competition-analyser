import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }
}).outputText
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const cacheUrl = moduleUrl(compile('../src/lib/youtubeCache.ts'))
const youtubeUrl = moduleUrl(compile('../src/lib/youtube.ts').replace("'./youtubeCache'", JSON.stringify(cacheUrl)))
const analysisUrl = moduleUrl(compile('../src/lib/channelAnalysis.ts')
  .replace("'./youtube'", JSON.stringify(youtubeUrl))
  .replace("'./youtubeCache'", JSON.stringify(cacheUrl)))
const { loadChannelAnalysis } = await import(analysisUrl)
const result = () => ({ channelId: 'UC1234567890123456789012', channelTitle: 'Example', videos: [], fetchedAt: Date.now() })

test('fresh Convex analysis needs no YouTube request or API key', async () => {
  const fresh = result()
  const loaded = await loadChannelAnalysis('@Example', undefined, {
    get: async (key) => { assert.equal(key, 'forHandle:@example'); return fresh },
    save: async () => assert.fail('fresh cache should not be saved again')
  }, async () => assert.fail('fresh cache should not call YouTube'))
  assert.equal(loaded, fresh)
})

test('expired analysis fetches in browser and persists handle and canonical ID with original timestamp', async () => {
  const fresh = result()
  fresh.fetchedAt -= 1000
  const saved = []
  let requests = 0
  await loadChannelAnalysis('@Example', 'test-key', {
    get: async () => ({ ...fresh, fetchedAt: Date.now() - 86400000 }),
    save: async (value) => saved.push(value)
  }, async (input, key) => {
    requests++
    assert.equal(input, '@Example')
    assert.equal(key, 'test-key')
    return fresh
  })
  assert.equal(requests, 1)
  assert.deepEqual(saved.map((item) => item.lookupKey), ['forHandle:@example', `channelId:${fresh.channelId}`])
  assert.ok(saved.every((item) => item.fetchedAt === fresh.fetchedAt))
  await loadChannelAnalysis(fresh.channelId, undefined, {
    get: async (key) => saved.find((item) => item.lookupKey === key) ?? null,
    save: async () => assert.fail('canonical cache should not be saved again')
  }, async () => assert.fail('canonical cache should not call YouTube'))
})

test('failed browser fetch is not persisted and missing key is reported only on a miss', async () => {
  const cache = { get: async () => null, save: async () => assert.fail('failed request should not be cached') }
  await assert.rejects(loadChannelAnalysis('@Example', undefined, cache), /Missing VITE_YOUTUBE_API_KEY/)
  await assert.rejects(loadChannelAnalysis('@Example', 'test', cache, async () => { throw new Error('quota exceeded') }), /quota exceeded/)
})

test('browser video analysis stops after the latest 50 videos even when more pages exist', async () => {
  const originalFetch = globalThis.fetch
  let searchCalls = 0
  let detailCalls = 0
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname
    if (path.endsWith('/channels')) return { ok: true, json: async () => ({ items: [{ id: 'UC1234567890123456789012', snippet: { title: 'Example' } }] }) }
    if (path.endsWith('/search')) {
      searchCalls++
      return { ok: true, json: async () => ({ nextPageToken: 'more', items: Array.from({ length: 50 }, (_, i) => ({
        id: { videoId: `video${i}` }, snippet: { title: `Video ${i}`, publishedAt: '2026-10-01' }
      })) }) }
    }
    detailCalls++
    return { ok: true, json: async () => ({ items: [] }) }
  }
  try {
    const { fetchChannelVideos } = await import(youtubeUrl)
    const loaded = await fetchChannelVideos('@Example', 'test')
    assert.equal(loaded.videos.length, 50)
    assert.equal(searchCalls, 1)
    assert.equal(detailCalls, 1)
    assert.equal(loaded.channelId, 'UC1234567890123456789012')
  } finally { globalThis.fetch = originalFetch }
})
