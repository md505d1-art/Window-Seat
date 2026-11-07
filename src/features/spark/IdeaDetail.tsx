import { Archive, ArchiveRestore, ArrowLeft, Download, ExternalLink, FileText, Link2, Paperclip, Plus, Rocket, Sparkles, Trash, X } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbTitle, useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, TagInput, Textarea } from '@/components/ui/inputs'
import { Card, DemoBadge, ErrorState, ListSkeleton } from '@/components/ui/misc'
import { useBackend } from '@/features/auth/auth'
import { FavouriteButton } from '@/features/shared/bits'
import { useUploader } from '@/features/shared/PhotoUploader'
import { useFileUrls, useLogActivity, useRow, useRows, useTable } from '@/lib/data'
import { IDEA_STAGES, type Attachment, type SparkIdea } from '@/lib/types'
import { SaveState, STAGE_META, useAutosave } from './meta'

function safeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function Attachments({ value, onChange }: { value: Attachment[]; onChange: (a: Attachment[]) => void }) {
  const { upload, busy } = useUploader('spark')
  const backend = useBackend()
  const urls = useFileUrls(value.map((a) => a.path))
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {value.map((a) => {
            const url = urls.data?.[a.path]
            return (
              <li key={a.path} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border p-2">
                {a.mime.startsWith('image/') && url ? (
                  <img src={url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2">
                    <FileText className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                </span>
                {url && (
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={url} target="_blank" rel="noreferrer" download={a.name} aria-label={`Open ${a.name}`}>
                      <Download />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => {
                    onChange(value.filter((x) => x.path !== a.path))
                    backend.removeFiles([a.path]).catch(() => undefined)
                  }}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <Button variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
        <Paperclip /> Attach images or documents
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="Attach files"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!files.length) return
          const paths = await upload(files)
          onChange([...value, ...paths.map((path, i) => ({ path, name: files[i].name, mime: files[i].type || 'application/octet-stream', size: files[i].size }))])
        }}
      />
    </div>
  )
}

export function IdeaDetailPage() {
  const { id } = useParams()
  const idea = useRow('spark_ideas', id)
  if (idea.isLoading) return <ListSkeleton rows={5} />
  if (idea.error) return <ErrorState error={idea.error} onRetry={() => idea.refetch()} />
  if (!idea.data)
    return (
      <div className="py-16 text-center">
        <p className="font-medium">This idea no longer exists.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/spark">Back to ideas</Link>
        </Button>
      </div>
    )
  return <IdeaEditor key={idea.data.id} idea={idea.data} />
}

function IdeaEditor({ idea }: { idea: SparkIdea }) {
  const { update, remove } = useTable('spark_ideas')
  const folders = useRows('spark_folders', { order: [{ column: 'position', ascending: true }] })
  const project = useRow('spark_projects', idea.project_id ?? undefined)
  const backend = useBackend()
  const log = useLogActivity()
  const { open } = useUI()
  const navigate = useNavigate()
  const [draft, setDraft] = React.useState({
    title: idea.title, description: idea.description, category: idea.category, tags: idea.tags, folder_id: idea.folder_id,
    stage: idea.stage, links: idea.links, attachments: idea.attachments,
  })
  const [newLink, setNewLink] = React.useState({ url: '', label: '' })
  const [confirm, setConfirm] = React.useState(false)
  useCrumbTitle(draft.title || 'Idea')

  const save = useAutosave(draft, async (d) => {
    if (!d.title.trim()) return
    await update.mutateAsync({ id: idea.id, patch: { ...d, title: d.title.trim() } })
  })
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const linkUrl = safeUrl(newLink.url)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/spark" aria-label="Back to ideas">
              <ArrowLeft />
            </Link>
          </Button>
          <SaveState state={save} />
          <DemoBadge show={idea.is_demo} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavouriteButton on={idea.favourite} onToggle={() => update.mutate({ id: idea.id, patch: { favourite: !idea.favourite } })} label={idea.title} />
          <Button variant="outline" size="sm" onClick={() => navigate(`/spark/assistant?idea=${idea.id}`)}>
            <Sparkles /> Brainstorm
          </Button>
          {project.data ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/spark/projects/${project.data.id}`}>
                <Rocket /> Open project
              </Link>
            </Button>
          ) : (
            <Button variant="accent" size="sm" onClick={() => open('new-project', { ideaId: idea.id, title: draft.title, description: draft.description })}>
              <Rocket /> Turn into project
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={idea.archived ? 'Restore idea' : 'Archive idea'}
            title={idea.archived ? 'Restore' : 'Archive'}
            onClick={() => {
              update.mutate({ id: idea.id, patch: { archived: !idea.archived } })
              toast.success(idea.archived ? 'Idea restored' : 'Idea archived')
            }}
          >
            {idea.archived ? <ArchiveRestore /> : <Archive />}
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Delete idea" onClick={() => setConfirm(true)}>
            <Trash />
          </Button>
        </div>
      </div>

      {idea.archived && <p className="mb-4 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">This idea is archived. Restore it to see it in your idea lists again.</p>}

      <label htmlFor="idea-title-edit" className="sr-only">
        Title
      </label>
      <input
        id="idea-title-edit"
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        maxLength={300}
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground sm:text-3xl"
        placeholder="Untitled idea"
      />
      {!draft.title.trim() && <p className="mt-1 text-xs text-destructive">Give the idea a title to save changes.</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid min-w-0 content-start gap-4">
          <Card className="p-4">
            <Label>Description</Label>
            <Textarea aria-label="Description" rows={8} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="What is it, who is it for, why now?" className="mt-2 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
          </Card>
          <Card className="p-4">
            <Label>Links</Label>
            <ul className="mt-2 grid gap-1.5">
              {draft.links.map((l, i) => (
                <li key={l.url + i} className="flex min-w-0 items-center gap-2 text-sm">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-accent-text hover:underline">
                    {l.label || l.url}
                  </a>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove link ${l.label || l.url}`} onClick={() => set('links', draft.links.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!linkUrl) return
                set('links', [...draft.links, { url: linkUrl, label: newLink.label.trim() }])
                setNewLink({ url: '', label: '' })
              }}
            >
              <Input aria-label="Link URL" placeholder="https://…" value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} className="min-w-0 flex-1 basis-48" />
              <Input aria-label="Link label" placeholder="Label (optional)" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} className="min-w-0 flex-1 basis-32" />
              <Button type="submit" variant="outline" disabled={!linkUrl}>
                <Plus /> Add link
              </Button>
            </form>
            {newLink.url && !linkUrl && <p className="mt-1 text-xs text-destructive">That doesn’t look like a web address.</p>}
          </Card>
          <Card className="p-4">
            <Label>Attachments</Label>
            <div className="mt-3">
              <Attachments value={draft.attachments} onChange={(a) => set('attachments', a)} />
            </div>
          </Card>
        </div>
        <Card className="grid content-start gap-4 p-4">
          <Field label="Stage" htmlFor="idea-stage">
            <Select id="idea-stage" value={draft.stage} onChange={(e) => set('stage', e.target.value as SparkIdea['stage'])}>
              {IDEA_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Folder" htmlFor="idea-folder-edit">
            <Select id="idea-folder-edit" value={draft.folder_id ?? ''} onChange={(e) => set('folder_id', e.target.value || null)}>
              <option value="">No folder</option>
              {(folders.data ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="idea-category">
            <Input id="idea-category" value={draft.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Business, App, Creative" />
          </Field>
          <Field label="Tags" htmlFor="idea-tags-edit">
            <TagInput id="idea-tags-edit" value={draft.tags} onChange={(t) => set('tags', t)} />
          </Field>
          {project.data && (
            <p className="text-xs text-muted-foreground">
              Became the project{' '}
              <Link className="text-accent-text underline" to={`/spark/projects/${project.data.id}`}>
                {project.data.name}
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this idea?"
        description="The idea and its attachments are removed permanently. Archive it instead to keep it out of the way."
        onConfirm={async () => {
          await remove.mutateAsync(idea.id)
          if (idea.attachments.length) backend.removeFiles(idea.attachments.map((a) => a.path)).catch(() => undefined)
          log({ module: 'spark', action: 'deleted', entity_type: 'idea', title: idea.title })
          toast.success('Idea deleted')
          navigate('/spark')
        }}
      />
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>
}
