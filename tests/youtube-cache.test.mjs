import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }
}).outputText
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`

test('channel cache persists, shares requests, refreshes expired data, and retries failures', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const originalNow = Date.now
  const storage = new Map()
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }
  let now = 100000000
  Date.now = () => now
  let calls = 0
  const channel = {
    id: 'UC1234567890123456789012',
    snippet: { title: 'Example', customUrl: '@Example', publishedAt: '2020-01-01' },
    statistics: { subscriberCount: '100', videoCount: '10', viewCount: '1000' }
  }
  globalThis.fetch = async () => {
    calls++
    return { ok: true, json: async () => ({ items: [channel] }) }
  }
  const cacheCode = compile('../src/lib/youtubeCache.ts')
  const load = async (suffix) => {
    const cacheUrl = moduleUrl(cacheCode + `\n// ${suffix}`)
    const youtubeCode = compile('../src/lib/youtube.ts').replace("'./youtubeCache'", JSON.stringify(cacheUrl))
    return import(moduleUrl(youtubeCode))
  }
  try {
    const youtube = await load('first page')
    await Promise.all([
      youtube.fetchCompetitionMetrics(['@Example'], 'test'),
      youtube.fetchCompetitionMetrics(['https://www.youtube.com/@Example'], 'test')
    ])
    assert.equal(calls, 1, 'concurrent requests share one API call')
    const results = await youtube.fetchCompetitionMetrics([channel.id], 'test')
    assert.equal(results[0].subscriberCount, 100)
    assert.equal(calls, 1, 'channel ID reuses handle result')
    const reloaded = await load('reloaded page')
    await reloaded.fetchCompetitionMetrics(['@example'], 'test')
    assert.equal(calls, 1, 'fresh module reads persistent storage')
    now += 24 * 60 * 60 * 1000
    await reloaded.fetchCompetitionMetrics(['@example'], 'test')
    assert.equal(calls, 2, 'expired entry refreshes')
    globalThis.fetch = async () => { calls++; throw new Error('quota exceeded') }
    await assert.rejects(reloaded.fetchCompetitionMetrics(['@Other'], 'test'), /quota exceeded/)
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ items: [channel] }) } }
    await reloaded.fetchCompetitionMetrics(['@Other'], 'test')
    assert.equal(calls, 4, 'failed fetch can be retried')
    globalThis.localStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    const noStorage = await load('unavailable storage')
    await noStorage.fetchCompetitionMetrics(['@Example'], 'test')
    await noStorage.fetchCompetitionMetrics(['@Example'], 'test')
    assert.equal(calls, 5, 'memory cache works without browser storage')
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
    Date.now = originalNow
  }
})
