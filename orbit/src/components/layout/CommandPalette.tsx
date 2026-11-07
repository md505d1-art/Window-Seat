import { Command } from 'cmdk'
import { BookOpen, Lightbulb, ListChecks, Monitor, Moon, Package, Plane, Rocket, Search, Sun } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router'
import { HOME_NAV, MODULES, TASKS_NAV } from '@/app/nav'
import { useThemePreference } from '@/app/theme-preference'
import { useDialogState, useUI } from '@/app/ui-context'
import { searchDocs, useSearchIndex } from '@/features/shared/search'
import { useWorkspaces } from '@/features/shared/workspaces'
import { ModuleDot } from '@/features/shared/bits'

const item =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground aria-selected:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted-foreground'
const group = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground'

export function CommandPalette() {
  const state = useDialogState('palette')
  const { open } = useUI()
  const navigate = useNavigate()
  const { set: setTheme } = useThemePreference()
  const ws = useWorkspaces()
  const [query, setQuery] = React.useState('')
  const { docs } = useSearchIndex()
  const hits = React.useMemo(() => searchDocs(docs, query, 12), [docs, query])

  React.useEffect(() => {
    if (!state.open) setQuery('')
  }, [state.open])

  const go = (to: string) => {
    state.onOpenChange(false)
    navigate(to)
  }
  const run = (fn: () => void) => {
    state.onOpenChange(false)
    // Let the palette close before another dialog opens.
    setTimeout(fn, 0)
  }

  const pages = [HOME_NAV, ...MODULES.filter((m) => ws[m.id]).flatMap((m) => m.items.map((i) => ({ ...i, label: `${m.label}: ${i.label}` }))), TASKS_NAV]

  return (
    <Command.Dialog
      open={state.open}
      onOpenChange={state.onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-card animate-in"
    >
      <div className="flex items-center gap-2 border-b border-border px-3.5">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search items, ideas, trips… or type a command"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-1.5 scrollbar-thin">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No matches. Try another word.</Command.Empty>
        {hits.length > 0 && (
          <Command.Group heading="Results" className={group}>
            {hits.map((h) => (
              <Command.Item key={h.module + h.id} value={`${h.title} ${h.subtitle} ${h.id}`} onSelect={() => go(h.to)} className={item}>
                <ModuleDot module={h.module} />
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.kind}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Create" className={group}>
          {ws.flip && (
            <Command.Item onSelect={() => go('/flip/items/new')} className={item}>
              <Package /> New inventory item
            </Command.Item>
          )}
          {ws.spark && (
            <>
              <Command.Item onSelect={() => run(() => open('capture-idea'))} className={item}>
                <Lightbulb /> Capture an idea
              </Command.Item>
              <Command.Item onSelect={() => run(() => open('new-project'))} className={item}>
                <Rocket /> New project
              </Command.Item>
            </>
          )}
          <Command.Item onSelect={() => run(() => open('new-task'))} className={item}>
            <ListChecks /> New task
          </Command.Item>
          {ws.atlas && (
            <>
              <Command.Item onSelect={() => run(() => open('new-trip'))} className={item}>
                <Plane /> Plan a trip
              </Command.Item>
              <Command.Item onSelect={() => go('/atlas/journal?new=1')} className={item}>
                <BookOpen /> Write a journal entry
              </Command.Item>
            </>
          )}
        </Command.Group>
        <Command.Group heading="Go to" className={group}>
          {pages.map((p) => (
            <Command.Item key={p.to} onSelect={() => go(p.to)} className={item}>
              <p.icon /> {p.label}
            </Command.Item>
          ))}
          <Command.Item onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)} className={item}>
            <Search /> Search everything{query ? ` for “${query}”` : ''}
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Appearance" className={group}>
          <Command.Item onSelect={() => run(() => setTheme('dark'))} className={item}>
            <Moon /> Dark theme
          </Command.Item>
          <Command.Item onSelect={() => run(() => setTheme('light'))} className={item}>
            <Sun /> Light theme
          </Command.Item>
          <Command.Item onSelect={() => run(() => setTheme('system'))} className={item}>
            <Monitor /> Match system theme
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
