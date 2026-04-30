import { useEffect, useMemo, useState } from 'react'
import { useAction } from 'convex/react'
import { ChannelTable } from './components/ChannelTable'
import { ChannelAnalysisTable } from './components/ChannelAnalysisTable'
import { fetchCompetitionMetrics, type ChannelMetrics, type ChannelVideo } from './lib/youtube'
import { api } from '../convex/_generated/api'

const STORAGE_KEYS = {
  channels: 'yt-competition-channels',
  darkMode: 'yt-competition-dark-mode',
  cpm: 'yt-competition-cpm'
} as const

export function App() {
  const [activeTab, setActiveTab] = useState<'competition' | 'channel-analysis'>('competition')
  const [rawInput, setRawInput] = useState(() => localStorage.getItem(STORAGE_KEYS.channels) ?? '')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(STORAGE_KEYS.darkMode) === 'true')
  const [loading, setLoading] = useState(false)
  const [competitionProgress, setCompetitionProgress] = useState<{ completed: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ChannelMetrics[]>([])
  const [cpmInput, setCpmInput] = useState(() => localStorage.getItem(STORAGE_KEYS.cpm) ?? '')
  const [analysisInput, setAnalysisInput] = useState('')
  const [analysisTitle, setAnalysisTitle] = useState('')
  const [analysisVideos, setAnalysisVideos] = useState<ChannelVideo[]>([])

  const theme = darkMode
    ? { pageBg: '#1f1f1f', panelBg: '#262626', panelBorder: '#3a3a3a', text: '#f4f4f5', mutedText: '#d4d4d8', inputBg: '#2d2d2d' }
    : { pageBg: '#f3f4f6', panelBg: '#ffffff', panelBorder: '#d4d4d8', text: '#111111', mutedText: '#3f3f46', inputBg: '#ffffff' }

  const channels = useMemo(() => rawInput.split('\n').map((line) => line.trim()).filter(Boolean), [rawInput])

  useEffect(() => localStorage.setItem(STORAGE_KEYS.channels, rawInput), [rawInput])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.darkMode, String(darkMode)), [darkMode])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.cpm, cpmInput), [cpmInput])
  useEffect(() => {
    document.body.style.backgroundColor = theme.pageBg
  }, [theme.pageBg])

  const cpmValue = Number(cpmInput)
  const cpm = cpmInput.trim().length > 0 && Number.isFinite(cpmValue) ? cpmValue : null

  const withApiKey = (): string | null => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
    if (!apiKey) {
      setError('Missing VITE_YOUTUBE_API_KEY in your .env file')
      return null
    }
    return apiKey
  }

  const getOrFetchChannelAnalysis = useAction(api.channelAnalysisActions.getOrFetchAnalysis)

  const competitionProgressPercent =
    competitionProgress && competitionProgress.total > 0
      ? Math.round((competitionProgress.completed / competitionProgress.total) * 100)
      : 0

  const fetchData = async () => {
    const apiKey = withApiKey()
    if (!apiKey) return
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchCompetitionMetrics(channels, apiKey, { onProgress: (completed, total) => setCompetitionProgress({ completed, total }) }))
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error while fetching channels')
    } finally {
      setLoading(false)
      setCompetitionProgress(null)
    }
  }

  const loadChannelAnalysis = async (channelValue: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getOrFetchChannelAnalysis({ rawInput: channelValue })
      setAnalysisTitle(result.channelTitle)
      setAnalysisVideos(result.videos as ChannelVideo[])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error while fetching channel videos')
    } finally {
      setLoading(false)
      setCompetitionProgress(null)
    }
  }

  const fetchAnalysis = async () => {
    await loadChannelAnalysis(analysisInput)
  }

  const handleChannelClick = async (channel: ChannelMetrics) => {
    const channelValue = `https://www.youtube.com/channel/${channel.id}`
    setAnalysisInput(channelValue)
    setActiveTab('channel-analysis')
    await loadChannelAnalysis(channelValue)
  }

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'Inter, Arial, sans-serif', minHeight: '100vh', backgroundColor: theme.panelBg, color: theme.text, border: `1px solid ${theme.panelBorder}`, borderRadius: 12, transition: 'background-color 0.2s ease, color 0.2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h1>YouTube Competition Analyser</h1>
        <button type="button" onClick={() => setDarkMode((current) => !current)}>{darkMode ? 'Light mode' : 'Dark mode'}</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setActiveTab('competition')} disabled={activeTab === 'competition'}>Competition</button>
        <button type="button" onClick={() => setActiveTab('channel-analysis')} disabled={activeTab === 'channel-analysis'}>Channel analysis</button>
      </div>

      {activeTab === 'competition' ? (
        <>
          <p style={{ color: theme.mutedText }}>Paste one channel URL, handle, or username per line.</p>
          <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} rows={8} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.panelBorder}`, backgroundColor: theme.inputBg, color: theme.text }} placeholder={'https://www.youtube.com/@MrBeast\nhttps://www.youtube.com/user/PewDiePie'} />
          <div style={{ marginTop: 12 }}><button type="button" onClick={fetchData} disabled={loading || channels.length === 0}>{loading ? 'Loading…' : 'Analyse competitors'}</button></div>
          {loading && competitionProgress ? (
            <section style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: theme.mutedText }}>
                <span>Fetching channels…</span>
                <span>{competitionProgress.completed}/{competitionProgress.total} ({competitionProgressPercent}%)</span>
              </div>
              <div style={{ width: '100%', height: 10, borderRadius: 999, backgroundColor: theme.pageBg, overflow: 'hidden' }}>
                <div style={{ width: `${competitionProgressPercent}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.2s ease' }} />
              </div>
            </section>
          ) : null}
          <section style={{ marginTop: 16 }}>
            <label htmlFor="cpm-input" style={{ display: 'block', marginBottom: 8, color: theme.mutedText }}>CPM value (USD)</label>
            <input id="cpm-input" type="number" min={0} step="0.01" value={cpmInput} onChange={(event) => setCpmInput(event.target.value)} placeholder="e.g. 5.50" style={{ width: '100%', maxWidth: 240, padding: 10, borderRadius: 8, border: `1px solid ${theme.panelBorder}`, backgroundColor: theme.inputBg, color: theme.text }} />
          </section>
          {rows.length > 0 ? <ChannelTable rows={rows} darkMode={darkMode} cpm={cpm} onChannelClick={handleChannelClick} /> : null}
        </>
      ) : (
        <>
          <p style={{ color: theme.mutedText }}>Enter one channel URL, handle, or username.</p>
          <input value={analysisInput} onChange={(event) => setAnalysisInput(event.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.panelBorder}`, backgroundColor: theme.inputBg, color: theme.text }} placeholder="https://www.youtube.com/@MrBeast" />
          <div style={{ marginTop: 12 }}><button type="button" onClick={fetchAnalysis} disabled={loading || analysisInput.trim().length === 0}>{loading ? 'Loading…' : 'Analyse channel'}</button></div>
          {analysisVideos.length > 0 ? <h2 style={{ marginTop: 16 }}>{analysisTitle}</h2> : null}
          {analysisVideos.length > 0 ? <ChannelAnalysisTable videos={analysisVideos} darkMode={darkMode} /> : null}
        </>
      )}

      {error ? <p style={{ color: '#ff6b6b' }}>{error}</p> : null}
    </main>
  )
}
