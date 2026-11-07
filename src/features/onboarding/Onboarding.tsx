import { useQueryClient } from '@tanstack/react-query'
import { Check, Compass, Sparkles, Tag } from 'lucide-react'
import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/inputs'
import { useBackend, useSession } from '@/features/auth/auth'
import { useProfile, useUpdateProfile } from '@/lib/data'
import { cn, errorMessage } from '@/lib/utils'
import { seedDemoData } from './seed'

const WORKSPACES = [
  { id: 'flip', name: 'Flip', icon: Tag, color: 'var(--flip)', text: 'Inventory, listings and profit for reselling on Vinted, eBay and Depop.' },
  { id: 'spark', name: 'Spark', icon: Sparkles, color: 'var(--spark)', text: 'Capture ideas, plan projects, run task boards and brainstorm on a canvas.' },
  { id: 'atlas', name: 'Atlas', icon: Compass, color: 'var(--atlas)', text: 'Save places on a map, plan trips day by day and keep a travel journal.' },
] as const

type WS = { flip: boolean; spark: boolean; atlas: boolean }

export function OnboardingPage() {
  const { data: profile, isLoading } = useProfile()
  const session = useSession()
  const backend = useBackend()
  const update = useUpdateProfile()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState('')
  const [ws, setWs] = React.useState<WS>({ flip: true, spark: true, atlas: true })
  const [sample, setSample] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (profile?.display_name) setName(profile.display_name)
  }, [profile?.display_name])

  if (isLoading) return null
  if (profile?.onboarded) return <Navigate to="/" replace />

  const all = ws.flip && ws.spark && ws.atlas
  const none = !ws.flip && !ws.spark && !ws.atlas

  const finish = async () => {
    setBusy(true)
    try {
      if (sample) await seedDemoData(backend, ws)
      await update.mutateAsync({ display_name: name.trim(), workspaces: ws, onboarded: true, walkthrough_done: false })
      await qc.invalidateQueries()
      navigate('/', { replace: true })
      if (sample) toast.success('Sample data added. Look for the “Demo” label.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const steps = ['About you', 'Workspaces', 'Get started']

  return (
    <div className="flex min-h-dvh items-center justify-center px-[max(16px,env(safe-area-inset-left))] py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center gap-2 font-semibold">
          <img src={`${import.meta.env.BASE_URL}orbit.svg`} alt="" className="size-8 rounded-lg" /> Orbit
        </div>
        <ol className="mb-6 flex gap-2" aria-label="Setup progress">
          {steps.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={cn('h-1 rounded-full bg-surface-2', i <= step && 'bg-primary')} />
              <p className={cn('mt-1.5 text-xs text-muted-foreground', i === step && 'text-foreground')}>{s}</p>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form
            className="animate-in"
            onSubmit={(e) => {
              e.preventDefault()
              setStep(1)
            }}
          >
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to Orbit</h1>
            <p className="mt-1 text-sm text-muted-foreground">A personal workspace for reselling, ideas and travel. First, what should we call you?</p>
            <Field label="Your name" htmlFor="onb-name" className="mt-6">
              <Input id="onb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" autoFocus />
            </Field>
            {session.mode === 'local' && (
              <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
                You’re in demo mode. Everything you create stays in this browser on this device.
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Button type="submit">Continue</Button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="animate-in">
            <h1 className="text-2xl font-semibold tracking-tight">Which workspaces do you want?</h1>
            <p className="mt-1 text-sm text-muted-foreground">You can switch these on or off later in Settings.</p>
            <div className="mt-6 grid gap-3" role="group" aria-label="Workspaces">
              {WORKSPACES.map((w) => {
                const on = ws[w.id]
                return (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWs({ ...ws, [w.id]: !on })}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-input',
                      on && 'border-[color-mix(in_oklab,var(--primary)_60%,transparent)]',
                    )}
                    style={on ? { borderColor: `color-mix(in oklab, ${w.color} 60%, transparent)` } : undefined}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${w.color} 15%, transparent)`, color: w.color }}>
                      <w.icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{w.name}</span>
                      <span className="block text-sm text-muted-foreground">{w.text}</span>
                    </span>
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border border-input', on && 'border-transparent text-white')} style={on ? { background: w.color } : undefined}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
              <Button variant="ghost" className="justify-self-start" onClick={() => setWs({ flip: !all, spark: !all, atlas: !all })}>
                {all ? 'Clear selection' : 'Use all three'}
              </Button>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={none}>
                Continue
              </Button>
            </div>
            {none && <p className="mt-2 text-right text-xs text-muted-foreground">Pick at least one workspace.</p>}
          </div>
        )}

        {step === 2 && (
          <div className="animate-in">
            <h1 className="text-2xl font-semibold tracking-tight">Start empty or with examples?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sample data shows how each workspace fits together. It’s clearly labelled “Demo”, and you can remove it in one click from Settings.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Sample data">
              {[
                { v: true, t: 'Add sample data', d: 'Example inventory, a project with tasks, a planned trip and journal entries.' },
                { v: false, t: 'Start empty', d: 'A clean slate. Each page will show you how to add your first item.' },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  role="radio"
                  aria-checked={sample === o.v}
                  onClick={() => setSample(o.v)}
                  className={cn('rounded-2xl border border-border bg-surface p-4 text-left transition-colors', sample === o.v && 'border-primary')}
                >
                  <span className="block font-medium">{o.t}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{o.d}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={finish} loading={busy}>
                Open my Orbit
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
