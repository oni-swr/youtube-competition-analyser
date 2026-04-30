import { useMemo, useState } from 'react'
import { ChannelTable } from './components/ChannelTable'
import { fetchCompetitionMetrics, type ChannelMetrics } from './lib/youtube'

export function App() {
  const [rawInput, setRawInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ChannelMetrics[]>([])

  const channels = useMemo(
    () => rawInput.split('\n').map((line) => line.trim()).filter(Boolean),
    [rawInput]
  )

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
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'Inter, Arial, sans-serif' }}>
      <h1>YouTube Competition Analyser</h1>
      <p>Paste one channel URL, handle, or username per line.</p>
      <textarea
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        rows={8}
        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
        placeholder={'https://www.youtube.com/@MrBeast\nhttps://www.youtube.com/user/PewDiePie'}
      />
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={fetchData} disabled={loading || channels.length === 0}>
          {loading ? 'Loading…' : 'Analyse competitors'}
        </button>
      </div>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {rows.length > 0 ? <ChannelTable rows={rows} /> : null}
    </main>
  )
}
