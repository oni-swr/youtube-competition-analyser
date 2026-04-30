import { useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from '@tanstack/react-table'
import type { ChannelMetrics } from '../lib/youtube'

const columnHelper = createColumnHelper<ChannelMetrics>()

const columns = [
  columnHelper.accessor('title', { header: 'Channel' }),
  columnHelper.accessor('subscriberCount', {
    header: 'Subscribers',
    enableSorting: true,
    sortingFn: 'basic',
    cell: ({ getValue }) => getValue().toLocaleString()
  }),
  columnHelper.accessor('videoCount', {
    header: 'Videos',
    enableSorting: true,
    sortingFn: 'basic',
    cell: ({ getValue }) => getValue().toLocaleString()
  }),
  columnHelper.accessor('viewCount', {
    header: 'Total views',
    enableSorting: true,
    sortingFn: 'basic',
    cell: ({ getValue }) => getValue().toLocaleString()
  }),
  columnHelper.display({
    id: 'viewsPerSubscriber',
    header: 'Views / sub',
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const subscribersA = rowA.original.subscriberCount
      const subscribersB = rowB.original.subscriberCount

      const ratioA = subscribersA === 0 ? Number.NEGATIVE_INFINITY : rowA.original.viewCount / subscribersA
      const ratioB = subscribersB === 0 ? Number.NEGATIVE_INFINITY : rowB.original.viewCount / subscribersB

      return ratioA - ratioB
    },
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
  const [sorting, setSorting] = useState<SortingState>([])
  const borderColor = darkMode ? '#3a3a3a' : '#e4e4e7'
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const sortDirection = header.column.getIsSorted()
              const sortIndicator = sortDirection === 'asc' ? ' ↑' : sortDirection === 'desc' ? ' ↓' : ''

              return (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    textAlign: 'left',
                    borderBottom: `1px solid ${borderColor}`,
                    padding: 8,
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none'
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sortIndicator}
                </th>
              )
            })}
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
