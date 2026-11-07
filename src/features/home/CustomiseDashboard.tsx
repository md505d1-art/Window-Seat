import { ArrowDown, ArrowUp } from 'lucide-react'
import * as React from 'react'
import { useDialogState } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/inputs'
import { DEFAULT_WIDGETS } from '@/lib/backend/schema'
import { useProfile, useUpdateProfile } from '@/lib/data'
import type { WidgetId, WidgetPref } from '@/lib/types'

export const WIDGET_INFO: Record<WidgetId, { title: string; description: string; module?: 'flip' | 'spark' | 'atlas' }> = {
  'quick-actions': { title: 'Quick actions', description: 'Shortcuts to create things' },
  'upcoming-tasks': { title: 'Upcoming tasks', description: 'Tasks across every workspace, soonest first' },
  'flip-performance': { title: 'Reselling performance', description: 'This month’s sales and profit', module: 'flip' },
  'active-projects': { title: 'Active projects', description: 'Progress on your Spark projects', module: 'spark' },
  'upcoming-trips': { title: 'Upcoming trips', description: 'Countdown, itinerary and checklist', module: 'atlas' },
  'saved-destinations': { title: 'Saved destinations', description: 'Places you want to visit', module: 'atlas' },
  'recent-activity': { title: 'Recent activity', description: 'What changed lately' },
  favourites: { title: 'Favourites', description: 'Starred items from every workspace' },
}

/** Merges saved preferences with the default list so new widgets appear automatically. */
export function resolveWidgets(saved: WidgetPref[] | undefined): WidgetPref[] {
  const list = Array.isArray(saved) ? saved.filter((w) => w.id in WIDGET_INFO) : []
  for (const d of DEFAULT_WIDGETS) if (!list.some((w) => w.id === d.id)) list.push(d)
  return list
}

export function CustomiseDashboardDialog() {
  const state = useDialogState('customise-dashboard')
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const [list, setList] = React.useState<WidgetPref[]>([])

  React.useEffect(() => {
    if (state.open) setList(resolveWidgets(profile?.dashboard_widgets))
  }, [state.open, profile?.dashboard_widgets])

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    setList(next)
  }

  return (
    <Dialog {...state}>
      <DialogContent title="Customise your dashboard" description="Choose which widgets appear on Home and in what order.">
        <ul className="grid grid-cols-1 gap-1.5">
          {list.map((w, i) => {
            const info = WIDGET_INFO[w.id]
            const off = info.module && profile && !profile.workspaces[info.module]
            return (
              <li key={w.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                <Switch
                  id={`w-${w.id}`}
                  checked={w.visible}
                  onCheckedChange={(v) => setList(list.map((x) => (x.id === w.id ? { ...x, visible: v } : x)))}
                  aria-label={`Show ${info.title}`}
                />
                <label htmlFor={`w-${w.id}`} className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{info.title}</span>
                  <span className="block text-xs text-muted-foreground">{off ? 'Hidden while this workspace is off' : info.description}</span>
                </label>
                <div className="flex">
                  <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${info.title} up`}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${info.title} down`}>
                    <ArrowDown />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={() => setList(DEFAULT_WIDGETS)}>
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => state.onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              onClick={async () => {
                await update.mutateAsync({ dashboard_widgets: list })
                state.onOpenChange(false)
              }}
            >
              Save layout
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
