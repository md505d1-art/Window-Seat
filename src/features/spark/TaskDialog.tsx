import { CalendarDays, Trash } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { Badge } from '@/components/ui/misc'
import { useLogActivity, useRows, useTable } from '@/lib/data'
import { daysUntil, dayLabel } from '@/lib/format'
import { TASK_PRIORITIES, TASK_STATUSES, type SparkTask } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PRIORITY_META, TASK_STATUS_META } from './meta'

export function useTaskActions() {
  const { update, remove } = useTable('spark_tasks')
  const log = useLogActivity()
  const link = (t: SparkTask) => (t.project_id ? `/spark/projects/${t.project_id}?tab=tasks` : '/tasks')
  const mod = (t: SparkTask) => (t.module === 'general' ? 'orbit' : t.module)
  const move = (t: SparkTask, status: SparkTask['status'], position = t.position) => {
    const patch: Partial<SparkTask> = { status, position, completed_at: status === 'completed' ? t.completed_at ?? new Date().toISOString() : null }
    update.mutate({ id: t.id, patch })
    if (status !== t.status) log({ module: mod(t), action: status === 'completed' ? 'completed' : `moved to ${TASK_STATUS_META[status].label.toLowerCase()}`, entity_type: 'task', entity_id: t.id, title: t.title, link: link(t) })
  }
  return {
    move,
    toggle: (t: SparkTask) => move(t, t.status === 'completed' ? 'todo' : 'completed'),
    async save(t: SparkTask, patch: Partial<SparkTask>) {
      if (patch.status && patch.status !== t.status) patch.completed_at = patch.status === 'completed' ? new Date().toISOString() : null
      await update.mutateAsync({ id: t.id, patch })
    },
    async destroy(t: SparkTask) {
      await remove.mutateAsync(t.id)
      log({ module: mod(t), action: 'deleted', entity_type: 'task', title: t.title })
    },
  }
}

export function TaskCard({ task, onOpen, projectName }: { task: SparkTask; onOpen?: () => void; projectName?: string }) {
  const d = daysUntil(task.due_date)
  return (
    <div
      onClick={onOpen}
      className="cursor-grab rounded-xl border border-border bg-surface p-3 text-left shadow-xs transition-colors hover:border-input active:cursor-grabbing"
    >
      <p className={cn('text-sm leading-snug', task.status === 'completed' && 'text-muted-foreground line-through')}>{task.title}</p>
      {projectName && <p className="mt-0.5 truncate text-xs text-muted-foreground">{projectName}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.priority !== 'medium' && <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>}
        {task.due_date && (
          <span className={cn('inline-flex items-center gap-1 text-[11px] tabular', d !== null && d < 0 && task.status !== 'completed' ? 'text-destructive' : 'text-muted-foreground')}>
            <CalendarDays className="size-3" /> {dayLabel(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

export function TaskDialog({ task, onClose }: { task: SparkTask | null; onClose: () => void }) {
  const actions = useTaskActions()
  const milestones = useRows('spark_milestones', task?.project_id ? { eq: { project_id: task.project_id } } : undefined, Boolean(task?.project_id))
  const projects = useRows('spark_projects')
  const [draft, setDraft] = React.useState<SparkTask | null>(task)
  const [confirm, setConfirm] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => setDraft(task), [task])
  if (!draft || !task) return null
  const set = <K extends keyof SparkTask>(k: K, v: SparkTask[K]) => setDraft({ ...draft, [k]: v })
  const project = projects.data?.find((p) => p.id === draft.project_id)

  return (
    <>
      <Dialog open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent title="Edit task" size="md">
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!draft.title.trim()) return
              setBusy(true)
              try {
                await actions.save(task, {
                  title: draft.title.trim(), description: draft.description, status: draft.status, priority: draft.priority,
                  due_date: draft.due_date, milestone_id: draft.milestone_id, project_id: draft.project_id,
                })
                toast.success('Task saved')
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            <Field label="Task" htmlFor="t-title">
              <Input id="t-title" value={draft.title} onChange={(e) => set('title', e.target.value)} required maxLength={300} />
            </Field>
            <Field label="Notes" htmlFor="t-desc">
              <Textarea id="t-desc" rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" htmlFor="t-status">
                <Select id="t-status" value={draft.status} onChange={(e) => set('status', e.target.value as SparkTask['status'])}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority" htmlFor="t-priority">
                <Select id="t-priority" value={draft.priority} onChange={(e) => set('priority', e.target.value as SparkTask['priority'])}>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Due date" htmlFor="t-due">
                <Input id="t-due" type="date" value={draft.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} />
              </Field>
              <Field label="Project" htmlFor="t-project">
                <Select id="t-project" value={draft.project_id ?? ''} onChange={(e) => setDraft({ ...draft, project_id: e.target.value || null, milestone_id: null })}>
                  <option value="">No project</option>
                  {(projects.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {draft.project_id && (milestones.data ?? []).length > 0 && (
                <Field label="Milestone" htmlFor="t-milestone" className="sm:col-span-2">
                  <Select id="t-milestone" value={draft.milestone_id ?? ''} onChange={(e) => set('milestone_id', e.target.value || null)}>
                    <option value="">No milestone</option>
                    {(milestones.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            {project && (
              <p className="text-xs text-muted-foreground">
                In{' '}
                <Link to={`/spark/projects/${project.id}`} className="underline" onClick={onClose}>
                  {project.name}
                </Link>
              </p>
            )}
            <DialogFooter className="justify-between">
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
                <Trash /> Delete
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" loading={busy}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this task?"
        description={`“${task.title}” will be removed permanently.`}
        onConfirm={async () => {
          await actions.destroy(task)
          onClose()
        }}
      />
    </>
  )
}
