import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ChannelMetrics } from '../lib/youtube'

const columnHelper = createColumnHelper<ChannelMetrics>()

const columns = [
  columnHelper.accessor('title', { header: 'Channel' }),
  columnHelper.accessor('subscriberCount', {
    header: 'Subscribers',
    cell: ({ getValue }) => getValue().toLocaleString()
  }),
  columnHelper.accessor('videoCount', {
    header: 'Videos',
    cell: ({ getValue }) => getValue().toLocaleString()
  }),
  columnHelper.accessor('viewCount', {
    header: 'Total views',
    cell: ({ getValue }) => getValue().toLocaleString()
  }),
  columnHelper.display({
    id: 'viewsPerSubscriber',
    header: 'Views / sub',
    cell: ({ row }) => {
      const subscribers = row.original.subscriberCount
      const views = row.original.viewCount
      if (subscribers === 0) {
        return 'N/A'
      }
      return (views / subscribers).toFixed(2)
    }
  })
]

export function ChannelTable({ rows, darkMode = false }: { rows: ChannelMetrics[]; darkMode?: boolean }) {
  const borderColor = darkMode ? '#3a3a3a' : '#e4e4e7'
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                style={{
                  textAlign: 'left',
                  borderBottom: `1px solid ${borderColor}`,
                  padding: 8
                }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                style={{
                  borderBottom: `1px solid ${borderColor}`,
                  padding: 8
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
