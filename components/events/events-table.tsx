"use client"

import { useMemo } from 'react'
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender } from '@tanstack/react-table'
import { format } from 'date-fns'
import type { EventWithLanguages } from '@/lib/types/event'

interface EventsTableProps {
  events: EventWithLanguages[]
}

const columnHelper = createColumnHelper<EventWithLanguages>()

export function EventsTable({ events }: EventsTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <div className="font-medium">{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor('start_time', {
        header: 'Start Time',
        cell: (info) => (
          <div className="text-sm text-muted-foreground">
            {format(new Date(info.getValue()), 'MMM d, yyyy h:mm a')}
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {String(info.getValue()).charAt(0).toUpperCase() + String(info.getValue()).slice(1)}
          </span>
        ),
      }),
      columnHelper.accessor('room_name', {
        header: 'Room',
        cell: (info) => (
          <div className="text-sm text-muted-foreground">
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('event_languages', {
        header: 'Languages',
        cell: (info) => {
          const eventLanguages = info.getValue()
          if (!eventLanguages || eventLanguages.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {eventLanguages.map((eventLang, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                  title={`${eventLang.language.name_en} (${eventLang.language.name_native})`}
                >
                  {eventLang.language.name_en}
                </span>
              ))}
            </div>
          )
        },
      }),
    ],
    []
  )

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No events yet. Create your first event.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="text-left py-3 px-4 font-medium text-sm">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-muted/50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-3 px-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
