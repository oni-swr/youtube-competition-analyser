import { useMemo, useState } from 'react'
import type { ChannelVideo } from '../lib/youtube'

type SortMode = 'outlier' | 'newest' | 'oldest' | 'views'
type FormatFilter = 'all' | 'short' | 'long' | 'live'

export function ChannelAnalysisTable({ videos, darkMode }: { videos: ChannelVideo[]; darkMode?: boolean }) {
  const [sortMode, setSortMode] = useState<SortMode>('outlier')
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('long')
  const borderColor = darkMode ? '#3a3a3a' : '#e4e4e7'

  const sortedVideos = useMemo(() => {
    const filtered = formatFilter === 'all' ? videos : videos.filter((video) => video.format === formatFilter)
    const sorted = [...filtered]
    if (sortMode === 'newest') {
      sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    } else if (sortMode === 'oldest') {
      sorted.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
    } else if (sortMode === 'views') {
      sorted.sort((a, b) => b.viewCount - a.viewCount)
    } else {
      sorted.sort((a, b) => (b.outlierScore ?? Number.NEGATIVE_INFINITY) - (a.outlierScore ?? Number.NEGATIVE_INFINITY))
    }
    return sorted
  }, [formatFilter, sortMode, videos])

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="video-format" style={{ marginRight: 8 }}>Type</label>
        <select id="video-format" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as FormatFilter)} style={{ marginRight: 12 }}>
          <option value="all">All videos</option>
          <option value="short">Shorts</option>
          <option value="long">Long-form</option>
          <option value="live">Livestreams</option>
        </select>
        <label htmlFor="video-sort" style={{ marginRight: 8 }}>Sort by</label>
        <select id="video-sort" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="outlier">Outlier score</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="views">Amount of views</option>
        </select>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${borderColor}` }}>Thumbnail</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${borderColor}` }}>Title</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${borderColor}` }}>Published</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${borderColor}` }}>Views</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${borderColor}` }}>Outlier score</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${borderColor}` }}>Median baseline views</th>
          </tr>
        </thead>
        <tbody>
          {sortedVideos.map((video) => (
            <tr key={video.id}>
              <td style={{ padding: 8, borderBottom: `1px solid ${borderColor}` }}>
                {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} width={120} style={{ borderRadius: 4 }} /> : 'N/A'}
              </td>
              <td style={{ padding: 8, borderBottom: `1px solid ${borderColor}` }}>{video.title}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${borderColor}` }}>{new Date(video.publishedAt).toLocaleDateString()}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${borderColor}` }}>{video.viewCount.toLocaleString()}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${borderColor}` }}>
                {video.outlierScore === null ? 'N/A' : `${video.outlierScore.toFixed(2)}x`}
              </td>
              <td style={{ padding: 8, borderBottom: `1px solid ${borderColor}` }}>
                {video.medianBaselineViews === null ? 'N/A' : Math.round(video.medianBaselineViews).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
