import { ClipboardCopy, Info, Plus, Rocket, Save, Sparkles, X } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { Card, PageHeader } from '@/components/ui/misc'
import { useBackend } from '@/features/auth/auth'
import { brainstorm, BRAINSTORM_MODES, describeAiStatus, useAiStatus, type BrainstormMode, type BrainstormOutput } from '@/lib/ai'
import { invalidate, useLogActivity, useRows, useTable } from '@/lib/data'
import { copyText, errorMessage } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

function asText(out: BrainstormOutput): string {
  return [
    out.summary,
    ...out.sections.map((s) => [`\n## ${s.heading}`, ...s.items.map((i) => `- ${i.title}${i.detail ? `: ${i.detail}` : ''}`)].join('\n')),
  ].join('\n')
}

export function AssistantPage() {
  const [params] = useSearchParams()
  const ideas = useRows('spark_ideas', { eq: { archived: false } })
  const ai = useAiStatus()
  const ideaTable = useTable('spark_ideas')
  const backend = useBackend()
  const qc = useQueryClient()
  const log = useLogActivity()
  const navigate = useNavigate()
  const [ideaId, setIdeaId] = React.useState(params.get('idea') ?? '')
  const idea = ideas.data?.find((i) => i.id === ideaId)
  const [text, setText] = React.useState('')
  const [context, setContext] = React.useState('')
  const [modes, setModes] = React.useState<Set<BrainstormMode>>(new Set(['expand', 'features', 'audience', 'mvp', 'milestones']))
  const [out, setOut] = React.useState<BrainstormOutput | null>(null)
  const [busy, setBusy] = React.useState<'run' | 'save' | 'project' | null>(null)

  React.useEffect(() => {
    if (idea) setText(`${idea.title}${idea.description ? `\n\n${idea.description}` : ''}`)
  }, [idea])

  const ready = ai.data?.state === 'ready'

  const run = async () => {
    setBusy('run')
    try {
      setOut(await brainstorm({ idea: text.trim(), context: context.trim(), modes: [...modes] }))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const editItem = (si: number, ii: number, patch: Partial<{ title: string; detail: string }>) =>
    setOut((o) => o && { ...o, sections: o.sections.map((s, a) => (a !== si ? s : { ...s, items: s.items.map((it, b) => (b === ii ? { ...it, ...patch } : it)) })) })
  const removeItem = (si: number, ii: number) => setOut((o) => o && { ...o, sections: o.sections.map((s, a) => (a !== si ? s : { ...s, items: s.items.filter((_, b) => b !== ii) })) })
  const addItem = (si: number) => setOut((o) => o && { ...o, sections: o.sections.map((s, a) => (a !== si ? s : { ...s, items: [...s.items, { title: '', detail: '' }] })) })

  const saveToIdea = async () => {
    if (!out) return
    setBusy('save')
    try {
      const body = asText(out)
      if (idea) {
        await ideaTable.update.mutateAsync({ id: idea.id, patch: { description: `${idea.description}\n\n— Brainstorm —\n${body}`.trim(), stage: idea.stage === 'inbox' ? 'exploring' : idea.stage } })
        toast.success('Added to the idea')
      } else {
        const created = await ideaTable.create.mutateAsync({ title: text.split('\n')[0].slice(0, 300) || 'Brainstorm', description: body, stage: 'exploring' })
        toast.success('Saved as a new idea')
        navigate(`/spark/ideas/${created.id}`)
      }
    } finally {
      setBusy(null)
    }
  }

  const createProject = async () => {
    if (!out) return
    setBusy('project')
    try {
      const nameSection = out.sections.find((s) => s.mode === 'names')
      const name = nameSection?.items[0]?.title || idea?.title || text.split('\n')[0].slice(0, 200) || 'New project'
      const project = await backend.insert('spark_projects', { name, description: out.summary, status: 'planning' })
      const ms = out.sections.find((s) => s.mode === 'milestones')?.items.filter((i) => i.title.trim()) ?? []
      const created = await backend.insertMany('spark_milestones', ms.map((m, i) => ({ project_id: project.id, title: m.title.trim(), description: m.detail, position: (i + 1) * 1000 })))
      const taskSource = out.sections.find((s) => s.mode === 'mvp') ?? out.sections.find((s) => s.mode === 'plan') ?? out.sections.find((s) => s.mode === 'features')
      const tasks = taskSource?.items.filter((i) => i.title.trim()) ?? []
      await backend.insertMany('spark_tasks', tasks.map((t, i) => ({ project_id: project.id, milestone_id: created[0]?.id ?? null, title: t.title.trim().slice(0, 300), description: t.detail, status: 'todo' as const, position: (i + 1) * 1000 })))
      if (idea) await backend.update('spark_ideas', idea.id, { project_id: project.id, stage: 'converted' })
      invalidate(qc, backend, ['spark_projects', 'spark_milestones', 'spark_tasks', 'spark_ideas'])
      log({ module: 'spark', action: 'created from brainstorm', entity_type: 'project', entity_id: project.id, title: project.name, link: `/spark/projects/${project.id}` })
      toast.success(`Project created with ${created.length} milestones and ${tasks.length} tasks`)
      navigate(`/spark/projects/${project.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Spark" title="Brainstorming assistant" description="Develop a rough idea into features, audiences, an MVP and a milestone plan. Every suggestion is editable before you use it." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="grid content-start gap-4 p-4 sm:p-5">
          <Field label="Start from an idea" htmlFor="as-idea">
            <Select id="as-idea" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
              <option value="">Write it out below</option>
              {(ideas.data ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="The idea" htmlFor="as-text">
            <Textarea id="as-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="A rough description is fine." />
          </Field>
          <Field label="Context" htmlFor="as-context" hint="Optional: your skills, budget, time available, constraints.">
            <Textarea id="as-context" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="text-[13px] font-medium">What should it work on?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {BRAINSTORM_MODES.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={modes.has(m.id)}
                    onCheckedChange={(v) => {
                      const s = new Set(modes)
                      if (v) s.add(m.id)
                      else s.delete(m.id)
                      setModes(s)
                    }}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button variant="accent" onClick={run} loading={busy === 'run'} disabled={!ready || !text.trim() || modes.size === 0}>
            <Sparkles /> Brainstorm
          </Button>
          {!ai.isLoading && !ready && ai.data && (
            <p className="flex gap-1.5 rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {describeAiStatus(ai.data)} Orbit doesn’t show made-up suggestions in place of real AI output. Your ideas, projects and canvas all work without it.
              </span>
            </p>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          {!out ? (
            <div className="grid h-full min-h-60 place-items-center text-center text-sm text-muted-foreground">
              <p className="max-w-sm">Results appear here as editable lists. You can save them to the idea or turn them into a project with milestones and tasks.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              <Field label="Summary" htmlFor="as-summary">
                <Textarea id="as-summary" rows={3} value={out.summary} onChange={(e) => setOut({ ...out, summary: e.target.value })} />
              </Field>
              {out.sections.map((s, si) => (
                <section key={s.mode + si}>
                  <h3 className="text-sm font-semibold">{s.heading}</h3>
                  <ul className="mt-2 grid gap-2">
                    {s.items.map((it, ii) => (
                      <li key={ii} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-xl border border-border p-2">
                        <Input aria-label={`${s.heading} item ${ii + 1} title`} value={it.title} onChange={(e) => editItem(si, ii, { title: e.target.value })} className="h-8 border-0 bg-transparent px-1 font-medium shadow-none" />
                        <Button variant="ghost" size="icon-sm" onClick={() => removeItem(si, ii)} aria-label={`Remove ${it.title || 'item'}`}>
                          <X />
                        </Button>
                        <Textarea aria-label={`${s.heading} item ${ii + 1} detail`} value={it.detail} onChange={(e) => editItem(si, ii, { detail: e.target.value })} rows={2} className="col-span-2 min-h-0 border-0 bg-transparent px-1 py-0 text-muted-foreground shadow-none" />
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" size="sm" className="mt-1" onClick={() => addItem(si)}>
                    <Plus /> Add
                  </Button>
                </section>
              ))}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="accent" onClick={createProject} loading={busy === 'project'}>
                  <Rocket /> Create project from this
                </Button>
                <Button variant="outline" onClick={saveToIdea} loading={busy === 'save'}>
                  <Save /> {idea ? 'Add to the idea' : 'Save as an idea'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (await copyText(asText(out))) toast.success('Copied')
                  }}
                >
                  <ClipboardCopy /> Copy
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
