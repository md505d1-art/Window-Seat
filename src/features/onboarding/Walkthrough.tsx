import { Compass, Command as CommandIcon, Sparkles, Tag, type LucideIcon } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/misc'
import { useProfile, useUpdateProfile } from '@/lib/data'

interface Step {
  target?: string
  title: string
  body: React.ReactNode
  icon: LucideIcon
  color: string
  to?: string
}

/** A short guided tour of the activated workspaces, shown once after onboarding. */
export function Walkthrough() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const navigate = useNavigate()
  const [i, setI] = React.useState(0)
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  const steps = React.useMemo<Step[]>(() => {
    if (!profile) return []
    const s: Step[] = []
    if (profile.workspaces.flip)
      s.push({ target: 'flip', icon: Tag, color: 'var(--flip)', title: 'Flip — your reselling desk', to: '/flip', body: 'Add stock with photos and an automatic SKU, write listings in the right format, then mark items sold to see true profit after fees and postage.' })
    if (profile.workspaces.spark)
      s.push({ target: 'spark', icon: Sparkles, color: 'var(--spark)', title: 'Spark — ideas into projects', to: '/spark', body: 'Capture ideas in seconds. When one is worth doing, turn it into a project with milestones, a task board, a calendar and a canvas.' })
    if (profile.workspaces.atlas)
      s.push({ target: 'atlas', icon: Compass, color: 'var(--atlas)', title: 'Atlas — travel companion', to: '/atlas', body: 'Search for places and pin them to your map, plan trips day by day with a checklist, and keep a journal of where you’ve been.' })
    s.push({ icon: CommandIcon, color: 'var(--primary)', title: 'Jump anywhere', body: <>Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> (or <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>) to search everything and create items from the keyboard.</> })
    return s
  }, [profile])

  const active = Boolean(profile?.onboarded && !profile.walkthrough_done && steps.length)
  const step = steps[i]

  React.useLayoutEffect(() => {
    if (!active || !step?.target) {
      setRect(null)
      return
    }
    const measure = () => {
      const el = document.querySelector(`aside [data-tour="${step.target}"]`)
      const r = el?.getBoundingClientRect()
      setRect(r && r.width > 0 ? r : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [active, step])

  if (!active || !step) return null

  const done = () => update.mutate({ walkthrough_done: true })
  const last = i === steps.length - 1
  const cardStyle: React.CSSProperties = rect
    ? { position: 'fixed', top: Math.min(rect.top, window.innerHeight - 260), left: rect.right + 16 }
    : { position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)' }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="absolute inset-0 bg-black/45" onClick={done} />
      {rect && (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-offset-4 ring-offset-transparent transition-all duration-300"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: Math.min(rect.height, 40) + 8, boxShadow: `0 0 0 9999px rgb(0 0 0 / 0.0)`, ['--tw-ring-color' as string]: step.color }}
        />
      )}
      <div style={cardStyle} className="w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-card animate-in">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${step.color} 16%, transparent)`, color: step.color }}>
            <step.icon className="size-4" />
          </span>
          <h2 id="tour-title" className="text-sm font-semibold">
            {step.title}
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular">
            {i + 1} of {steps.length}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={done}>
              Skip tour
            </Button>
            {step.to && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate(step.to!)
                }}
              >
                Show me
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? done() : setI(i + 1))}>
              {last ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
