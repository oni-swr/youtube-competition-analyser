import { useState, useMemo } from 'react'
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

export function ChannelTable({ rows, darkMode = false, cpm }: { rows: ChannelMetrics[]; darkMode?: boolean; cpm: number | null }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const borderColor = darkMode ? '#3a3a3a' : '#e4e4e7'

  const columns = useMemo(
    () => [
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
      columnHelper.accessor(
        (row) => {
          if (row.subscriberCount === 0) {
            return Number.NEGATIVE_INFINITY
          }
          return row.viewCount / row.subscriberCount
        },
        {
          id: 'viewsPerSubscriber',
          header: 'Views / sub',
          cell: ({ getValue }) => {
            const value = getValue()
            if (value === Number.NEGATIVE_INFINITY) {
              return 'N/A'
            }
            return value.toFixed(2)
          }
        }
      ),
      columnHelper.accessor(
        (row) => {
          if (cpm === null) {
            return Number.NEGATIVE_INFINITY
          }
          return (row.viewCount / 1000) * cpm
        },
        {
          id: 'estimatedRevenue',
          header: 'Est. revenue',
          cell: ({ getValue }) => {
            const value = getValue()
            if (value === Number.NEGATIVE_INFINITY) {
              return 'N/A'
            }
            return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          }
        }
      )
    ],
    [cpm]
  )

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
