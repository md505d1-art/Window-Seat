import * as React from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useDialogState, useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Select, TagInput, Textarea } from '@/components/ui/inputs'
import { useLogActivity, useRows, useTable } from '@/lib/data'
import { TASK_PRIORITIES, type SparkProject, type TaskPriority } from '@/lib/types'
import { CustomiseDashboardDialog } from '@/features/home/CustomiseDashboard'

export function CaptureIdeaDialog() {
  const state = useDialogState('capture-idea')
  const { dialogProps } = useUI()
  const { create } = useTable('spark_ideas')
  const folders = useRows('spark_folders', { order: [{ column: 'position', ascending: true }] })
  const log = useLogActivity()
  const navigate = useNavigate()
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [folderId, setFolderId] = React.useState('')
  const [tags, setTags] = React.useState<string[]>([])

  React.useEffect(() => {
    if (state.open) {
      setTitle(dialogProps.title ?? '')
      setDescription(dialogProps.description ?? '')
      setFolderId('')
      setTags([])
    }
  }, [state.open, dialogProps])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const idea = await create.mutateAsync({ title: title.trim(), description, folder_id: folderId || null, tags })
    log({ module: 'spark', action: 'created', entity_type: 'idea', entity_id: idea.id, title: idea.title, link: `/spark/ideas/${idea.id}` })
    state.onOpenChange(false)
    toast.success('Idea captured', { action: { label: 'Open', onClick: () => navigate(`/spark/ideas/${idea.id}`) } })
  }

  return (
    <Dialog {...state}>
      <DialogContent title="Capture an idea" description="Get it down now. You can shape it later in Spark." className="module-spark">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Idea" htmlFor="idea-title">
            <Input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly vintage drop newsletter" autoFocus required maxLength={300} />
          </Field>
          <Field label="Details" htmlFor="idea-desc" hint="Optional">
            <Textarea id="idea-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Folder" htmlFor="idea-folder">
              <Select id="idea-folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">No folder</option>
                {(folders.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="idea-tags">
              <TagInput id="idea-tags" value={tags} onChange={setTags} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => state.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={create.isPending} disabled={!title.trim()}>
              Save idea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewTaskDialog() {
  const state = useDialogState('new-task')
  const { dialogProps } = useUI()
  const { create } = useTable('spark_tasks')
  const projects = useRows('spark_projects')
  const log = useLogActivity()
  const [title, setTitle] = React.useState('')
  const [projectId, setProjectId] = React.useState('')
  const [due, setDue] = React.useState('')
  const [priority, setPriority] = React.useState<TaskPriority>('medium')
  const [module, setModule] = React.useState<'spark' | 'flip' | 'atlas' | 'general'>('general')

  React.useEffect(() => {
    if (state.open) {
      setTitle(dialogProps.title ?? '')
      setProjectId(dialogProps.projectId ?? '')
      setDue(dialogProps.dueDate ?? '')
      setPriority('medium')
      setModule(dialogProps.module ?? (dialogProps.projectId ? 'spark' : 'general'))
    }
  }, [state.open, dialogProps])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const task = await create.mutateAsync({
      title: title.trim(),
      project_id: projectId || null,
      due_date: due || null,
      priority,
      module: projectId ? 'spark' : module,
      status: 'todo',
      position: Date.now(),
    })
    log({ module: task.module === 'general' ? 'orbit' : task.module, action: 'created', entity_type: 'task', entity_id: task.id, title: task.title, link: task.project_id ? `/spark/projects/${task.project_id}?tab=tasks` : '/tasks' })
    state.onOpenChange(false)
    toast.success('Task added')
  }

  const active = (projects.data ?? []).filter((p: SparkProject) => p.status !== 'archived')
  return (
    <Dialog {...state}>
      <DialogContent title="New task">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Task" htmlFor="task-title">
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={300} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project" htmlFor="task-project">
              <Select id="task-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!projectId && (
              <Field label="Area" htmlFor="task-module">
                <Select id="task-module" value={module} onChange={(e) => setModule(e.target.value as typeof module)}>
                  <option value="general">General</option>
                  <option value="flip">Flip</option>
                  <option value="spark">Spark</option>
                  <option value="atlas">Atlas</option>
                </Select>
              </Field>
            )}
            <Field label="Due date" htmlFor="task-due">
              <Input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Priority" htmlFor="task-priority">
              <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => state.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewProjectDialog() {
  const state = useDialogState('new-project')
  const { dialogProps } = useUI()
  const { create } = useTable('spark_projects')
  const ideas = useTable('spark_ideas')
  const trips = useRows('atlas_trips')
  const log = useLogActivity()
  const navigate = useNavigate()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [kind, setKind] = React.useState<SparkProject['kind']>('general')
  const [tripId, setTripId] = React.useState('')
  const [start, setStart] = React.useState('')
  const [due, setDue] = React.useState('')

  React.useEffect(() => {
    if (state.open) {
      setName(dialogProps.title ?? '')
      setDescription(dialogProps.description ?? '')
      setKind('general')
      setTripId('')
      setStart('')
      setDue('')
    }
  }, [state.open, dialogProps])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const project = await create.mutateAsync({
      name: name.trim(),
      description,
      kind,
      linked_flip: kind === 'reselling',
      linked_trip_id: kind === 'travel' && tripId ? tripId : null,
      start_date: start || null,
      due_date: due || null,
      status: 'active',
    })
    if (dialogProps.ideaId) {
      await ideas.update.mutateAsync({ id: dialogProps.ideaId, patch: { project_id: project.id, stage: 'converted' } })
    }
    log({ module: 'spark', action: dialogProps.ideaId ? 'converted idea to project' : 'created', entity_type: 'project', entity_id: project.id, title: project.name, link: `/spark/projects/${project.id}` })
    state.onOpenChange(false)
    toast.success('Project created')
    navigate(`/spark/projects/${project.id}`)
  }

  return (
    <Dialog {...state}>
      <DialogContent title={dialogProps.ideaId ? 'Turn idea into a project' : 'New project'} className="module-spark">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Project name" htmlFor="project-name">
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={200} />
          </Field>
          <Field label="Description" htmlFor="project-desc">
            <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label="Type" htmlFor="project-kind" hint={kind === 'reselling' ? 'Links this plan to your Flip workspace: its overview shows live sales figures.' : kind === 'travel' ? 'Link it to an Atlas trip to see the itinerary from the project.' : undefined}>
            <Select id="project-kind" value={kind} onChange={(e) => setKind(e.target.value as SparkProject['kind'])}>
              <option value="general">General project</option>
              <option value="reselling">Reselling business plan (links to Flip)</option>
              <option value="travel">Travel project (links to Atlas)</option>
            </Select>
          </Field>
          {kind === 'travel' && (
            <Field label="Linked trip" htmlFor="project-trip">
              <Select id="project-trip" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">Choose a trip later</option>
                {(trips.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="project-start">
              <Input id="project-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Target date" htmlFor="project-due">
              <Input id="project-due" type="date" value={due} min={start || undefined} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => state.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={create.isPending} disabled={!name.trim()}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewTripDialog() {
  const state = useDialogState('new-trip')
  const { create } = useTable('atlas_trips')
  const log = useLogActivity()
  const navigate = useNavigate()
  const [title, setTitle] = React.useState('')
  const [destination, setDestination] = React.useState('')
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [budget, setBudget] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (state.open) {
      setTitle('')
      setDestination('')
      setStart('')
      setEnd('')
      setBudget(null)
    }
  }, [state.open])

  const invalidDates = Boolean(start && end && end < start)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || invalidDates) return
    const trip = await create.mutateAsync({ title: title.trim(), destination, start_date: start || null, end_date: end || null, budget })
    log({ module: 'atlas', action: 'planned', entity_type: 'trip', entity_id: trip.id, title: trip.title, link: `/atlas/trips/${trip.id}` })
    state.onOpenChange(false)
    toast.success('Trip created')
    navigate(`/atlas/trips/${trip.id}`)
  }

  return (
    <Dialog {...state}>
      <DialogContent title="Plan a trip" className="module-atlas">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Trip name" htmlFor="trip-title">
            <Input id="trip-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Long weekend in Lisbon" autoFocus required maxLength={200} />
          </Field>
          <Field label="Destination" htmlFor="trip-dest">
            <Input id="trip-dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="City, region or country" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="trip-start">
              <Input id="trip-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End date" htmlFor="trip-end" error={invalidDates ? 'The end date is before the start date.' : undefined}>
              <Input id="trip-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-invalid={invalidDates} />
            </Field>
          </div>
          <Field label="Budget" htmlFor="trip-budget" hint="Optional">
            <MoneyInput id="trip-budget" value={budget} onChange={setBudget} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => state.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={create.isPending} disabled={!title.trim() || invalidDates}>
              Create trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GlobalDialogs() {
  return (
    <>
      <CaptureIdeaDialog />
      <NewTaskDialog />
      <NewProjectDialog />
      <NewTripDialog />
      <CustomiseDashboardDialog />
    </>
  )
}
