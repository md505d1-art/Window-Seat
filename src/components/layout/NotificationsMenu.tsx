import { Bell, CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { ModuleDot } from '@/features/shared/bits'
import { useBackend } from '@/features/auth/auth'
import { invalidate, useRows, useTable } from '@/lib/data'
import { relativeTime } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { NotificationRow } from '@/lib/types'

export function useMarkAllRead() {
  const backend = useBackend()
  const qc = useQueryClient()
  return async (rows: NotificationRow[]) => {
    const now = new Date().toISOString()
    await Promise.all(rows.filter((n) => !n.read_at).map((n) => backend.update('notifications', n.id, { read_at: now })))
    invalidate(qc, backend, ['notifications'])
  }
}

export function NotificationList({ rows, onPick, compact }: { rows: NotificationRow[]; onPick?: () => void; compact?: boolean }) {
  const { update } = useTable('notifications')
  const navigate = useNavigate()
  return (
    <ul className="grid grid-cols-1 gap-0.5">
      {rows.map((n) => (
        <li key={n.id}>
          <button
            className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2', !n.read_at && 'bg-[color-mix(in_oklab,var(--primary)_7%,transparent)]')}
            onClick={() => {
              if (!n.read_at) update.mutate({ id: n.id, patch: { read_at: new Date().toISOString() } })
              onPick?.()
              if (n.link) navigate(n.link)
            }}
          >
            <ModuleDot module={n.module} className="mt-1.5" />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm', !n.read_at && 'font-medium')}>{n.title}</span>
              {n.body && <span className={cn('block text-xs text-muted-foreground', compact && 'line-clamp-2')}>{n.body}</span>}
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</span>
            </span>
            {!n.read_at && <span className="mt-1.5 size-2 rounded-full bg-primary" aria-label="Unread" />}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function NotificationsMenu() {
  const { data = [] } = useRows('notifications', { limit: 30 })
  const unread = data.filter((n) => !n.read_at)
  const markAll = useMarkAllRead()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}>
          <Bell />
          {unread.length > 0 && (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary-fill px-1 text-[9px] leading-4 font-bold text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-2rem))] p-1.5">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAll(data)}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        {data.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">You’re all caught up.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            <NotificationList rows={data.slice(0, 8)} compact />
          </div>
        )}
        <div className="border-t border-border px-2.5 pt-1.5 pb-1">
          <Link to="/notifications" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
