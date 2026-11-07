import { Archive, Columns3, Folder, FolderPlus, Inbox, LayoutGrid, Lightbulb, List, Paperclip, Pencil, Plus, Search, Star, Trash } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/inputs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu'
import { Badge, DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader, Segmented } from '@/components/ui/misc'
import { FavouriteButton } from '@/features/shared/bits'
import { useRows, useTable } from '@/lib/data'
import { relativeTime } from '@/lib/format'
import { IDEA_STAGES, type IdeaStage, type SparkFolder, type SparkIdea } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Board } from './Board'
import { STAGE_META } from './meta'

type View = 'grid' | 'list' | 'board'
type Scope = { kind: 'all' } | { kind: 'favourites' } | { kind: 'archived' } | { kind: 'unfiled' } | { kind: 'folder'; id: string }

const VIEW_KEY = 'orbit-ideas-view'

function IdeaCard({ idea, onFav }: { idea: SparkIdea; onFav: () => void }) {
  return (
    <div className="relative h-full">
    <div className="absolute top-3 right-3 z-10">
      <FavouriteButton on={idea.favourite} onToggle={onFav} label={idea.title} />
    </div>
    <Link
      to={`/spark/ideas/${idea.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 pr-11 shadow-card transition-colors hover:border-input"
    >
      <h3 className="text-sm leading-snug font-medium group-hover:underline">{idea.title}</h3>
      {idea.description && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{idea.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <Badge tone={STAGE_META[idea.stage].tone}>{STAGE_META[idea.stage].label}</Badge>
        {idea.tags.slice(0, 3).map((t) => (
          <Badge key={t} tone="outline">
            #{t}
          </Badge>
        ))}
        {idea.attachments.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <Paperclip className="size-3" />
            {idea.attachments.length}
          </span>
        )}
        <DemoBadge show={idea.is_demo} />
      </div>
    </Link>
    </div>
  )
}

function FolderDialog({ folder, open, onOpenChange }: { folder: SparkFolder | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { create, update } = useTable('spark_folders')
  const [name, setName] = React.useState('')
  React.useEffect(() => setName(folder?.name ?? ''), [folder, open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={folder ? 'Rename folder' : 'New folder'} size="sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return
            if (folder) await update.mutateAsync({ id: folder.id, patch: { name: name.trim() } })
            else await create.mutateAsync({ name: name.trim(), position: Date.now() })
            onOpenChange(false)
          }}
        >
          <Field label="Folder name" htmlFor="folder-name">
            <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={!name.trim()}>
              {folder ? 'Rename' : 'Create folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function IdeasPage() {
  const ideas = useRows('spark_ideas')
  const folders = useRows('spark_folders', { order: [{ column: 'position', ascending: true }] })
  const { update } = useTable('spark_ideas')
  const folderTable = useTable('spark_folders')
  const { open } = useUI()
  const navigate = useNavigate()
  const [view, setViewState] = React.useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || 'grid'
    } catch {
      return 'grid'
    }
  })
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }
  const [scope, setScope] = React.useState<Scope>({ kind: 'all' })
  const [query, setQuery] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [stage, setStage] = React.useState<IdeaStage | ''>('')
  const [folderDialog, setFolderDialog] = React.useState<{ open: boolean; folder: SparkFolder | null }>({ open: false, folder: null })
  const [deleteFolder, setDeleteFolder] = React.useState<SparkFolder | null>(null)

  const all = ideas.data ?? []
  const tags = [...new Set(all.flatMap((i) => i.tags))].sort()
  const list = all.filter((i) => {
    if (scope.kind === 'archived' ? !i.archived : i.archived) return false
    if (scope.kind === 'favourites' && !i.favourite) return false
    if (scope.kind === 'unfiled' && i.folder_id) return false
    if (scope.kind === 'folder' && i.folder_id !== scope.id) return false
    if (tag && !i.tags.includes(tag)) return false
    if (stage && i.stage !== stage) return false
    const q = query.trim().toLowerCase()
    if (q && !`${i.title} ${i.description} ${i.category} ${i.tags.join(' ')}`.toLowerCase().includes(q)) return false
    return true
  })
  const fav = (i: SparkIdea) => update.mutate({ id: i.id, patch: { favourite: !i.favourite } })
  const count = (pred: (i: SparkIdea) => boolean) => all.filter((i) => !i.archived && pred(i)).length

  const scopes: { scope: Scope; label: string; icon: typeof Inbox; n: number }[] = [
    { scope: { kind: 'all' }, label: 'All ideas', icon: Lightbulb, n: count(() => true) },
    { scope: { kind: 'favourites' }, label: 'Favourites', icon: Star, n: count((i) => i.favourite) },
    { scope: { kind: 'unfiled' }, label: 'Not in a folder', icon: Inbox, n: count((i) => !i.folder_id) },
  ]
  const same = (a: Scope, b: Scope) => a.kind === b.kind && (a.kind !== 'folder' || (b.kind === 'folder' && a.id === b.id))
  const scopeButton = (s: Scope, label: string, Icon: typeof Inbox, n: number) => (
    <button
      key={label}
      onClick={() => setScope(s)}
      aria-current={same(scope, s) ? 'true' : undefined}
      className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground', same(scope, s) && 'bg-surface-2 text-foreground')}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular">{n}</span>
    </button>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Spark"
        title="Ideas"
        description="Capture everything. Shape the good ones. Turn the best into projects."
        actions={
          <Button variant="accent" size="sm" onClick={() => open('capture-idea')}>
            <Plus /> Capture idea
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Idea folders" className="grid content-start gap-0.5">
          {scopes.map((s) => scopeButton(s.scope, s.label, s.icon, s.n))}
          <div className="mt-3 mb-1 flex items-center justify-between px-2.5">
            <span className="text-xs font-medium text-muted-foreground">Folders</span>
            <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => setFolderDialog({ open: true, folder: null })} aria-label="New folder">
              <FolderPlus className="size-3.5" />
            </Button>
          </div>
          {(folders.data ?? []).map((f) => (
            <div key={f.id} className="group flex items-center">
              {scopeButton({ kind: 'folder', id: f.id }, f.name, Folder, count((i) => i.folder_id === f.id))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="size-6 shrink-0 opacity-60 group-hover:opacity-100" aria-label={`Folder options for ${f.name}`}>
                    <Pencil className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setFolderDialog({ open: true, folder: f })}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => setDeleteFolder(f)}>
                    <Trash /> Delete folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {(folders.data ?? []).length === 0 && <p className="px-2.5 text-xs text-muted-foreground">No folders yet.</p>}
          <div className="mt-3">{scopeButton({ kind: 'archived' }, 'Archived', Archive, all.filter((i) => i.archived).length)}</div>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ideas" className="pl-9" aria-label="Search ideas" />
            </div>
            <Select value={stage} onChange={(e) => setStage(e.target.value as IdeaStage | '')} aria-label="Filter by stage" className="w-36">
              <option value="">All stages</option>
              {IDEA_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </Select>
            <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className="w-36">
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </Select>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: 'Grid', icon: LayoutGrid },
                { value: 'list', label: 'List', icon: List },
                { value: 'board', label: 'Board', icon: Columns3 },
              ]}
            />
          </div>

          {ideas.isLoading ? (
            <ListSkeleton rows={5} />
          ) : ideas.error ? (
            <ErrorState error={ideas.error} onRetry={() => ideas.refetch()} />
          ) : all.length === 0 ? (
            <EmptyState icon={Lightbulb} title="No ideas yet" description="Press ⌘K or the New button anywhere in Orbit to capture an idea in seconds." action={<Button variant="accent" onClick={() => open('capture-idea')}><Plus /> Capture your first idea</Button>} />
          ) : list.length === 0 && view !== 'board' ? (
            <EmptyState icon={Search} title="Nothing here" description="No ideas match these filters." />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((i) => (
                <IdeaCard key={i.id} idea={i} onFav={() => fav(i)} />
              ))}
            </div>
          ) : view === 'list' ? (
            <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {list.map((i) => (
                <li key={i.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5 hover:bg-surface-2/50">
                  <FavouriteButton on={i.favourite} onToggle={() => fav(i)} label={i.title} />
                  <Link to={`/spark/ideas/${i.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{i.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{i.description || 'No description'}</span>
                  </Link>
                  <div className="hidden items-center gap-1.5 sm:flex">
                    {i.tags.slice(0, 2).map((t) => (
                      <Badge key={t} tone="outline">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                  <Badge tone={STAGE_META[i.stage].tone}>{STAGE_META[i.stage].label}</Badge>
                  <span className="hidden w-20 text-right text-xs text-muted-foreground md:block">{relativeTime(i.updated_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Board
              label="Ideas by stage"
              columns={IDEA_STAGES.map((s) => ({ id: s, label: STAGE_META[s].label, tone: STAGE_META[s].tone }))}
              items={list}
              columnOf={(i) => i.stage}
              onMove={(i, s) => {
                if (s === 'converted' && !i.project_id) {
                  open('new-project', { ideaId: i.id, title: i.title, description: i.description })
                  return
                }
                update.mutate({ id: i.id, patch: { stage: s } })
              }}
              renderCard={(i) => (
                <div onClick={() => navigate(`/spark/ideas/${i.id}`)} className="cursor-grab rounded-xl border border-border bg-surface p-3 active:cursor-grabbing">
                  <p className="text-sm leading-snug font-medium">{i.title}</p>
                  {i.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.description}</p>}
                  {i.tags.length > 0 && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{i.tags.map((t) => `#${t}`).join(' ')}</p>}
                </div>
              )}
            />
          )}
        </div>
      </div>
      <FolderDialog open={folderDialog.open} folder={folderDialog.folder} onOpenChange={(o) => setFolderDialog({ ...folderDialog, open: o })} />
      <ConfirmDialog
        open={Boolean(deleteFolder)}
        onOpenChange={(o) => !o && setDeleteFolder(null)}
        title={`Delete the “${deleteFolder?.name}” folder?`}
        description="The ideas inside are kept and moved to “Not in a folder”."
        onConfirm={async () => {
          if (!deleteFolder) return
          await folderTable.remove.mutateAsync(deleteFolder.id)
          if (scope.kind === 'folder' && scope.id === deleteFolder.id) setScope({ kind: 'all' })
          toast.success('Folder deleted')
        }}
      />
    </div>
  )
}
