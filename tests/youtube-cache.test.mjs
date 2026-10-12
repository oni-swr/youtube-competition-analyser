import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'

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
    const manyChannels = Array.from({ length: 500 }, (_, index) => `@channel${index}`)
    await noStorage.fetchCompetitionMetrics(manyChannels, 'test')
    let browserGotTurn = false
    const browserTurn = new Promise((resolve) => setTimeout(() => { browserGotTurn = true; resolve() }, 0))
    const beforeCachedRun = calls
    let progressGotTurn = false
    await noStorage.fetchCompetitionMetrics(manyChannels, 'test', {
      onProgress: (completed) => {
        if (completed === 1) setTimeout(() => { progressGotTurn = true }, 0)
        if (completed === 50) assert.equal(progressGotTurn, true, 'browser handles input between cached batches')
      }
    })
    assert.equal(calls, beforeCachedRun, 'large cached run makes no API calls')
    assert.equal(browserGotTurn, true, 'cached run yields so browser can paint and handle input')
    await browserTurn
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
    Date.now = originalNow
  }
})

test('large competitor table renders only 50 result rows', () => {
  const require = createRequire(import.meta.url)
  const source = readFileSync(new URL('../src/components/ChannelTable.tsx', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const exports = {}
  new Function('exports', 'require', code)(exports, require)
  const { createElement } = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const rows = Array.from({ length: 500 }, (_, index) => ({
    id: String(index), title: `Channel ${index}`, publishedAt: '2020-01-01',
    subscriberCount: 100, videoCount: 10, viewCount: 1000
  }))
  const html = renderToStaticMarkup(createElement(exports.ChannelTable, { rows, cpm: null }))
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr>/g) ?? []).length, 50)
  assert.match(html, /Page 1 of 10/)
  assert.match(html, /500 channels/)
})
