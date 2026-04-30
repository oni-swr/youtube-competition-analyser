import { useEffect, useMemo, useState } from 'react'
import { ChannelTable } from './components/ChannelTable'
import { fetchCompetitionMetrics, type ChannelMetrics } from './lib/youtube'

const STORAGE_KEYS = {
  channels: 'yt-competition-channels',
  darkMode: 'yt-competition-dark-mode'
} as const

export function App() {
  const [rawInput, setRawInput] = useState(() => localStorage.getItem(STORAGE_KEYS.channels) ?? '')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(STORAGE_KEYS.darkMode) === 'true')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ChannelMetrics[]>([])

  const theme = darkMode
    ? {
        pageBg: '#1f1f1f',
        panelBg: '#262626',
        panelBorder: '#3a3a3a',
        text: '#f4f4f5',
        mutedText: '#d4d4d8',
        inputBg: '#2d2d2d'
      }
    : {
        pageBg: '#f3f4f6',
        panelBg: '#ffffff',
        panelBorder: '#d4d4d8',
        text: '#111111',
        mutedText: '#3f3f46',
        inputBg: '#ffffff'
      }

  const channels = useMemo(
    () => rawInput.split('\n').map((line) => line.trim()).filter(Boolean),
    [rawInput]
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.channels, rawInput)
  }, [rawInput])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.darkMode, String(darkMode))
  }, [darkMode])

  useEffect(() => {
    document.body.style.backgroundColor = theme.pageBg
  }, [theme.pageBg])

  const fetchData = async () => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
    if (!apiKey) {
      setError('Missing VITE_YOUTUBE_API_KEY in your .env file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const metrics = await fetchCompetitionMetrics(channels, apiKey)
      setRows(metrics)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error while fetching channels')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'Inter, Arial, sans-serif',
        minHeight: '100vh',
        backgroundColor: theme.panelBg,
        color: theme.text,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 12,
        transition: 'background-color 0.2s ease, color 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h1>YouTube Competition Analyser</h1>
        <button type="button" onClick={() => setDarkMode((current) => !current)}>
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
      <p style={{ color: theme.mutedText }}>Paste one channel URL, handle, or username per line.</p>
      <textarea
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        rows={8}
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 8,
          border: `1px solid ${theme.panelBorder}`,
          backgroundColor: theme.inputBg,
          color: theme.text
        }}
        placeholder={'https://www.youtube.com/@MrBeast\nhttps://www.youtube.com/user/PewDiePie'}
      />
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={fetchData} disabled={loading || channels.length === 0}>
          {loading ? 'Loading…' : 'Analyse competitors'}
        </button>
      </div>
      {error ? <p style={{ color: '#ff6b6b' }}>{error}</p> : null}
      {rows.length > 0 ? <ChannelTable rows={rows} darkMode={darkMode} /> : null}
    </main>
  )
}
