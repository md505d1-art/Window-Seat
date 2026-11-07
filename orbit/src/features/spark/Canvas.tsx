import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import { ArrowLeft, ExternalLink, Image as ImageIcon, Link2, Network, Plus, StickyNote, Trash, Type } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbTitle } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/inputs'
import { DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/misc'
import { useTheme } from '@/app/theme'
import { useUploader } from '@/features/shared/PhotoUploader'
import { useFileUrls, useLogActivity, useRow, useRows, useTable } from '@/lib/data'
import { relativeTime } from '@/lib/format'
import type { SparkCanvas } from '@/lib/types'
import { cn, uid } from '@/lib/utils'
import { SaveState, useAutosave } from './meta'

const STICKY_COLORS: Record<string, string> = {
  yellow: '#fde68a',
  green: '#bbf7d0',
  violet: '#ddd6fe',
  sky: '#bae6fd',
  rose: '#fecdd3',
}

type StickyData = { text: string; color: string }
type TextData = { text: string }
type ImageData = { path?: string; url?: string; caption?: string }
type LinkData = { url: string; title: string }

function useNodeText(id: string) {
  const { setNodes } = useReactFlow()
  return (patch: Record<string, unknown>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
}

const handles = (
  <>
    <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-surface !bg-spark" />
    <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-surface !bg-spark" />
  </>
)

function StickyNode({ id, data, selected }: NodeProps<Node<StickyData>>) {
  const patch = useNodeText(id)
  return (
    <div className="h-full min-h-28 w-full min-w-40 rounded-lg p-2.5 shadow-md" style={{ background: STICKY_COLORS[data.color] ?? STICKY_COLORS.yellow }}>
      <NodeResizer isVisible={selected} minWidth={140} minHeight={100} lineClassName="!border-spark" handleClassName="!bg-spark" />
      {handles}
      <textarea
        aria-label="Sticky note text"
        className="nodrag nowheel size-full min-h-24 resize-none bg-transparent text-sm leading-snug text-slate-900 outline-none placeholder:text-slate-600"
        value={data.text}
        placeholder="Write something…"
        onChange={(e) => patch({ text: e.target.value })}
      />
    </div>
  )
}

function TextNode({ id, data }: NodeProps<Node<TextData>>) {
  const patch = useNodeText(id)
  return (
    <div className="min-w-48 rounded-lg px-2 py-1">
      {handles}
      <input
        aria-label="Heading text"
        className="nodrag w-full bg-transparent text-xl font-semibold tracking-tight text-foreground outline-none"
        value={data.text}
        placeholder="Heading"
        onChange={(e) => patch({ text: e.target.value })}
      />
    </div>
  )
}

function ImageNode({ data, selected }: NodeProps<Node<ImageData>>) {
  const urls = useFileUrls(data.path ? [data.path] : [])
  const src = data.path ? urls.data?.[data.path] : data.url
  return (
    <div className="h-full w-full min-w-32 overflow-hidden rounded-lg border border-border bg-surface shadow-md">
      <NodeResizer isVisible={selected} minWidth={120} minHeight={90} keepAspectRatio lineClassName="!border-spark" handleClassName="!bg-spark" />
      {handles}
      {src ? <img src={src} alt={data.caption ?? ''} className="size-full object-cover" draggable={false} /> : <div className="skeleton size-full min-h-24" />}
    </div>
  )
}

function LinkNode({ data }: NodeProps<Node<LinkData>>) {
  let host = ''
  try {
    host = new URL(data.url).hostname
  } catch {
    host = data.url
  }
  return (
    <div className="w-56 rounded-lg border border-border bg-surface p-3 shadow-md">
      {handles}
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Link2 className="size-3.5 text-spark-text" /> <span className="truncate">{data.title || host}</span>
      </p>
      <a href={data.url} target="_blank" rel="noreferrer noopener" className="nodrag mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground">
        {host} <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

const nodeTypes = { sticky: StickyNode, text: TextNode, image: ImageNode, link: LinkNode }

export function CanvasListPage() {
  const canvases = useRows('spark_canvases', { order: [{ column: 'updated_at', ascending: false }] })
  const projects = useRows('spark_projects')
  const { create, remove } = useTable('spark_canvases')
  const navigate = useNavigate()
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [projectId, setProjectId] = React.useState('')
  const [toDelete, setToDelete] = React.useState<SparkCanvas | null>(null)
  return (
    <div>
      <PageHeader
        eyebrow="Spark"
        title="Canvas"
        description="Brainstorm with sticky notes, build moodboards and map how ideas connect."
        actions={
          <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
            <Plus /> New canvas
          </Button>
        }
      />
      {canvases.isLoading ? (
        <ListSkeleton rows={3} />
      ) : canvases.error ? (
        <ErrorState error={canvases.error} />
      ) : (canvases.data ?? []).length === 0 ? (
        <EmptyState icon={Network} title="No canvases yet" description="Create one to start arranging notes, images and links." action={<Button variant="accent" onClick={() => setCreating(true)}><Plus /> New canvas</Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(canvases.data ?? []).map((c) => {
            const p = projects.data?.find((x) => x.id === c.project_id)
            return (
              <li key={c.id} className="group relative rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-input">
                <Link to={`/spark/canvas/${c.id}`} className="block">
                  <div className="mb-3 grid h-24 place-items-center rounded-xl bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:12px_12px]">
                    <span className="text-xs text-muted-foreground tabular">
                      {c.data.nodes.length} item{c.data.nodes.length === 1 ? '' : 's'} · {c.data.edges.length} connection{c.data.edges.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h3 className="flex items-center gap-2 font-medium group-hover:underline">
                    {c.name} <DemoBadge show={c.is_demo} />
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {p ? `${p.name} · ` : ''}Edited {relativeTime(c.updated_at)}
                  </p>
                </Link>
                <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}>
                  <Trash />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent title="New canvas" size="sm" className="module-spark">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!name.trim()) return
              const c = await create.mutateAsync({ name: name.trim(), project_id: projectId || null })
              setCreating(false)
              setName('')
              navigate(`/spark/canvas/${c.id}`)
            }}
            className="grid gap-4"
          >
            <Field label="Name" htmlFor="canvas-name">
              <Input id="canvas-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={200} />
            </Field>
            <Field label="Project" htmlFor="canvas-project" hint="Optional">
              <Select id="canvas-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Not linked</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={!name.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="Everything on this canvas is removed permanently."
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id)
        }}
      />
    </div>
  )
}

export function CanvasPage() {
  const { id } = useParams()
  const canvas = useRow('spark_canvases', id)
  if (canvas.isLoading) return <ListSkeleton rows={4} />
  if (canvas.error) return <ErrorState error={canvas.error} />
  if (!canvas.data)
    return (
      <div className="py-16 text-center">
        <p className="font-medium">This canvas no longer exists.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/spark/canvas">All canvases</Link>
        </Button>
      </div>
    )
  return (
    <ReactFlowProvider>
      <CanvasEditor key={canvas.data.id} canvas={canvas.data} />
    </ReactFlowProvider>
  )
}

function CanvasEditor({ canvas }: { canvas: SparkCanvas }) {
  const { update } = useTable('spark_canvases')
  const log = useLogActivity()
  const { resolved } = useTheme()
  const flow = useReactFlow()
  const { upload, busy } = useUploader('spark')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(canvas.data.nodes as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(canvas.data.edges as Edge[])
  const [viewport, setViewport] = React.useState<Viewport | null>(canvas.data.viewport)
  const [name, setName] = React.useState(canvas.name)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [link, setLink] = React.useState({ url: '', title: '' })
  const imgInput = React.useRef<HTMLInputElement>(null)
  useCrumbTitle(name)

  // Strip transient UI state (selection, dragging) before saving.
  const snapshot = React.useMemo(
    () => ({
      name,
      nodes: nodes.map(({ id, type, position, data, width, height, style }) => ({ id, type, position, data, width, height, style })),
      edges: edges.map(({ id, source, target, sourceHandle, targetHandle, label }) => ({ id, source, target, sourceHandle, targetHandle, label })),
      viewport,
    }),
    [name, nodes, edges, viewport],
  )
  const state = useAutosave(snapshot, (s) =>
    update.mutateAsync({ id: canvas.id, patch: { name: s.name.trim() || canvas.name, data: { nodes: s.nodes, edges: s.edges, viewport: s.viewport } } }),
    900,
  )

  const centre = () => {
    const el = document.querySelector('.react-flow')?.getBoundingClientRect()
    const p = flow.screenToFlowPosition({ x: (el?.left ?? 0) + (el?.width ?? 600) / 2, y: (el?.top ?? 0) + (el?.height ?? 400) / 2 })
    return { x: p.x - 80 + Math.random() * 40, y: p.y - 50 + Math.random() * 40 }
  }
  const add = (type: keyof typeof nodeTypes, data: Record<string, unknown>, size?: { width: number; height: number }) =>
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: uid(), type, position: centre(), data, selected: true, ...(size ?? {}) }])

  const onConnect = React.useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, id: uid() }, es)), [setEdges])
  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length

  return (
    <div className="-mx-[max(16px,env(safe-area-inset-left))] -mt-5 flex h-[calc(100dvh-3.5rem)] flex-col sm:-mt-7 lg:-mx-8">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/spark/canvas" aria-label="All canvases">
            <ArrowLeft />
          </Link>
        </Button>
        <label htmlFor="canvas-title" className="sr-only">
          Canvas name
        </label>
        <input id="canvas-title" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 basis-32 bg-transparent text-sm font-semibold outline-none" maxLength={200} />
        <SaveState state={state} />
        <div className="flex flex-wrap items-center gap-1">
          {Object.keys(STICKY_COLORS).map((c) => (
            <button
              key={c}
              className="size-6 rounded-md border border-border transition-transform hover:scale-110"
              style={{ background: STICKY_COLORS[c] }}
              aria-label={`Add ${c} sticky note`}
              title={`Add ${c} sticky note`}
              onClick={() => add('sticky', { text: '', color: c }, { width: 180, height: 140 })}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => add('sticky', { text: '', color: 'yellow' }, { width: 180, height: 140 })} className="hidden sm:inline-flex">
            <StickyNote /> Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => add('text', { text: '' })}>
            <Type /> Heading
          </Button>
          <Button variant="outline" size="sm" loading={busy} onClick={() => imgInput.current?.click()}>
            <ImageIcon /> Image
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 /> Link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={!selectedCount}
            onClick={() => {
              const removed = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
              setNodes((ns) => ns.filter((n) => !n.selected))
              setEdges((es) => es.filter((e) => !e.selected && !removed.has(e.source) && !removed.has(e.target)))
            }}
          >
            <Trash /> Delete
          </Button>
        </div>
        <input
          ref={imgInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Add images to the canvas"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            const paths = await upload(files)
            paths.forEach((path, i) => add('image', { path, caption: files[i]?.name }, { width: 220, height: 160 }))
            if (paths.length) log({ module: 'spark', action: 'added images to', entity_type: 'canvas', entity_id: canvas.id, title: name, link: `/spark/canvas/${canvas.id}` })
          }}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={(_, vp) => setViewport(vp)}
          defaultViewport={canvas.data.viewport ?? undefined}
          fitView={!canvas.data.viewport && canvas.data.nodes.length > 0}
          colorMode={resolved}
          deleteKeyCode={['Backspace', 'Delete']}
          defaultEdgeOptions={{ style: { strokeWidth: 2 } }}
          proOptions={{ hideAttribution: false }}
          aria-label="Canvas"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className={cn('hidden md:block')} nodeColor={(n) => (n.type === 'sticky' ? STICKY_COLORS[(n.data as StickyData).color] ?? '#fde68a' : 'var(--muted-foreground)')} />
        </ReactFlow>
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">Add a sticky note, heading, image or link from the toolbar. Drag from a dot to connect two items.</div>
        )}
      </div>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent title="Add a link" size="sm">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              let url = link.url.trim()
              if (!/^https?:\/\//i.test(url)) url = `https://${url}`
              try {
                new URL(url)
              } catch {
                toast.error('That doesn’t look like a web address.')
                return
              }
              add('link', { url, title: link.title.trim() })
              setLink({ url: '', title: '' })
              setLinkOpen(false)
            }}
          >
            <Field label="Web address" htmlFor="cl-url">
              <Input id="cl-url" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://…" autoFocus required />
            </Field>
            <Field label="Title" htmlFor="cl-title" hint="Optional">
              <Input id="cl-title" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent">
                Add link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
