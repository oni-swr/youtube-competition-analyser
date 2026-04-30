import { useEffect, useMemo, useState } from 'react'
import { ChannelTable } from './components/ChannelTable'
import { fetchCompetitionMetrics, type ChannelMetrics } from './lib/youtube'

const STORAGE_KEYS = {
  channels: 'yt-competition-channels',
  darkMode: 'yt-competition-dark-mode'
}

export function App() {
  const [newChannel, setNewChannel] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ChannelMetrics[]>([])
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const savedChannels = window.localStorage.getItem(STORAGE_KEYS.channels)
    if (savedChannels) {
      const parsed = JSON.parse(savedChannels) as string[]
      setChannels(parsed)
    }

    const savedDarkMode = window.localStorage.getItem(STORAGE_KEYS.darkMode)
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.channels, JSON.stringify(channels))
  }, [channels])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.darkMode, String(isDarkMode))
  }, [isDarkMode])

  const dedupedChannels = useMemo(() => [...new Set(channels.map((item) => item.trim()).filter(Boolean))], [channels])

  const addChannel = () => {
    const trimmed = newChannel.trim()
    if (!trimmed) return

    setChannels((current) => (current.includes(trimmed) ? current : [...current, trimmed]))
    setNewChannel('')
  }

  const removeChannel = (channel: string) => {
    setChannels((current) => current.filter((item) => item !== channel))
  }

  const fetchData = async () => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
    if (!apiKey) {
      setError('Missing VITE_YOUTUBE_API_KEY in your .env file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const metrics = await fetchCompetitionMetrics(dedupedChannels, apiKey)
      setRows(metrics)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error while fetching channels')
    } finally {
      setLoading(false)
    }
  }

  const themeStyles = {
    background: isDarkMode ? '#111827' : '#f8fafc',
    color: isDarkMode ? '#f9fafb' : '#0f172a'
  }

  return (
    <main
      style={{
        ...themeStyles,
        minHeight: '100vh',
        maxWidth: 980,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'Inter, Arial, sans-serif'
      }}
    >
      <h1>YouTube Competition Analyser</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p>Add channels one at a time and compare them.</p>
        <button type="button" onClick={() => setIsDarkMode((current) => !current)}>
          {isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newChannel}
          onChange={(event) => setNewChannel(event.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #94a3b8' }}
          placeholder="Paste a channel URL, @handle, or username"
        />
        <button type="button" onClick={addChannel} disabled={!newChannel.trim()}>
          Add channel
        </button>
      </div>

      <ul style={{ marginTop: 12, paddingLeft: 20 }}>
        {dedupedChannels.map((channel) => (
          <li key={channel} style={{ marginBottom: 6 }}>
            {channel}{' '}
            <button type="button" onClick={() => removeChannel(channel)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={fetchData} disabled={loading || dedupedChannels.length === 0}>
          {loading ? 'Loading…' : 'Analyse competitors'}
        </button>
      </div>
      {error ? <p style={{ color: '#ef4444' }}>{error}</p> : null}
      {rows.length > 0 ? <ChannelTable rows={rows} isDarkMode={isDarkMode} /> : null}
    </main>
  )
}
