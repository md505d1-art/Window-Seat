import { useQueryClient } from '@tanstack/react-query'
import { Cloud, Compass, Database, Download, HardDrive, LayoutDashboard, LogOut, Monitor, Moon, Palette, Sparkles, Sun, Tag, Trash, UserRound, WandSparkles } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useThemePreference } from '@/app/theme-preference'
import { useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Switch } from '@/components/ui/inputs'
import { Badge, Card, PageHeader } from '@/components/ui/misc'
import { Avatar } from '@/components/layout/AppShell'
import { useAuth, useBackend, useSession } from '@/features/auth/auth'
import { removeDemoData, seedDemoData } from '@/features/onboarding/seed'
import { useUploader } from '@/features/shared/PhotoUploader'
import { describeAiStatus, useAiStatus } from '@/lib/ai'
import { TABLES } from '@/lib/backend/schema'
import type { SupabaseBackend } from '@/lib/backend/supabase'
import { useProfile, useRows, useUpdateProfile } from '@/lib/data'
import { shortDate, todayISO } from '@/lib/format'
import { getSupabase } from '@/lib/supabase-client'
import { cn, downloadFile, errorMessage } from '@/lib/utils'

function Section({ id, icon: Icon, title, description, children }: { id?: string; icon: typeof Palette; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

const CURRENCIES = ['GBP', 'EUR', 'USD', 'AUD', 'CAD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN']

export function SettingsPage() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const theme = useThemePreference()
  const session = useSession()
  const backend = useBackend()
  const { signOut, updatePassword } = useAuth()
  const ai = useAiStatus()
  const { open } = useUI()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const demoRows = useRows('flip_items', { eq: { is_demo: true } })
  const demoTrips = useRows('atlas_trips', { eq: { is_demo: true } })
  const demoIdeas = useRows('spark_ideas', { eq: { is_demo: true } })
  const hasDemo = (demoRows.data?.length ?? 0) + (demoTrips.data?.length ?? 0) + (demoIdeas.data?.length ?? 0) > 0
  const [confirmDemo, setConfirmDemo] = React.useState(false)
  const [confirmWipe, setConfirmWipe] = React.useState(false)
  const [confirmAccount, setConfirmAccount] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  }, [])

  if (!profile) return null
  const ws = profile.workspaces

  const exportAll = async () => {
    setBusy('export')
    try {
      const data: Record<string, unknown> = { exported_at: new Date().toISOString(), app: 'Orbit', profile }
      for (const t of TABLES) data[t] = await backend.list(t)
      downloadFile(`orbit-export-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json')
      toast.success('Your data was exported. Photos and files stay in storage; the export lists their paths.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <PageHeader title="Settings" description="Appearance, workspaces, data and your account." />

      <Section icon={Palette} title="Appearance">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {(
            [
              ['dark', 'Dark', Moon],
              ['light', 'Light', Sun],
              ['system', 'Match system', Monitor],
            ] as const
          ).map(([v, label, I]) => (
            <button
              key={v}
              role="radio"
              aria-checked={theme.theme === v}
              onClick={() => theme.set(v)}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-sm transition-colors hover:border-input', theme.theme === v && 'border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]')}
            >
              <I className="size-4" /> {label}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={LayoutDashboard} title="Workspaces" description="Turned-off workspaces disappear from navigation, Home and search. Their data is kept.">
        <div className="grid gap-2">
          {(
            [
              ['flip', 'Flip', 'Reselling and inventory', Tag, 'var(--flip)'],
              ['spark', 'Spark', 'Ideas and projects', Sparkles, 'var(--spark)'],
              ['atlas', 'Atlas', 'Travel and exploration', Compass, 'var(--atlas)'],
            ] as const
          ).map(([id, name, text, I, color]) => (
            <label key={id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}>
                <I className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{name}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
              </span>
              <Switch
                checked={ws[id]}
                onCheckedChange={(v) => {
                  const next = { ...ws, [id]: v }
                  if (!next.flip && !next.spark && !next.atlas) {
                    toast.error('Keep at least one workspace on.')
                    return
                  }
                  update.mutate({ workspaces: next })
                }}
                aria-label={`${name} workspace`}
                style={{ ['--accent' as string]: color }}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => open('customise-dashboard')}>
            <LayoutDashboard /> Customise Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              update.mutate({ walkthrough_done: false })
              navigate('/')
            }}
          >
            Replay the tour
          </Button>
        </div>
      </Section>

      <Section icon={Tag} title="Money" description="Used for Flip figures, reports and new trip budgets.">
        <Field label="Currency" htmlFor="set-currency" className="max-w-56">
          <Select id="set-currency" value={profile.currency} onChange={(e) => update.mutate({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <p className="mt-2 text-xs text-muted-foreground">Changing currency relabels amounts; it doesn’t convert them.</p>
      </Section>

      <Section icon={WandSparkles} title="AI assistants" description="The listing assistant and brainstorming use Claude through your own Supabase Edge Function.">
        <div className="flex items-start gap-2 text-sm">
          <Badge tone={ai.data?.state === 'ready' ? 'success' : 'warning'}>{ai.isLoading ? 'Checking…' : ai.data?.state === 'ready' ? 'Connected' : 'Not connected'}</Badge>
          <p className="text-muted-foreground">{ai.data ? describeAiStatus(ai.data) : 'Checking AI status…'}</p>
        </div>
      </Section>

      <Section id="backend" icon={session.mode === 'local' ? HardDrive : Cloud} title={session.mode === 'local' ? 'Demo mode' : 'Account'}>
        {session.mode === 'local' ? (
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              You’re using Orbit in demo mode. Everything is stored in this browser’s IndexedDB on this device only. It isn’t backed up or synced, and clearing site data deletes it.
            </p>
            <p className="text-muted-foreground">
              To use real accounts, create a Supabase project, run the SQL migration in <code className="font-mono text-xs">supabase/migrations</code>, and set <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code>. The README has the steps.
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <LogOut /> Leave demo mode
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm">
              Signed in as <span className="font-medium">{session.user.email}</span>
            </p>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (password.length < 8) {
                  toast.error('Use at least 8 characters.')
                  return
                }
                setBusy('password')
                try {
                  await updatePassword(password)
                  setPassword('')
                  toast.success('Password changed')
                } catch (err) {
                  toast.error(errorMessage(err))
                } finally {
                  setBusy(null)
                }
              }}
            >
              <Field label="New password" htmlFor="set-pw" className="min-w-0 flex-1 basis-48">
                <Input id="set-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" variant="outline" loading={busy === 'password'} disabled={!password}>
                Change password
              </Button>
            </form>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <LogOut /> Sign out
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section icon={Database} title="Data" description="Export or remove what you’ve stored in Orbit.">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Export everything</p>
              <p className="text-xs text-muted-foreground">A JSON file with every item, idea, project, task, place, trip and journal entry.</p>
            </div>
            <Button variant="outline" size="sm" loading={busy === 'export'} onClick={exportAll}>
              <Download /> Export JSON
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Sample data</p>
              <p className="text-xs text-muted-foreground">{hasDemo ? 'Everything marked “Demo” in your workspaces.' : 'Add example content to explore how the workspaces connect.'}</p>
            </div>
            {hasDemo ? (
              <Button variant="outline" size="sm" onClick={() => setConfirmDemo(true)}>
                <Trash /> Remove sample data
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={busy === 'seed'}
                onClick={async () => {
                  setBusy('seed')
                  try {
                    await seedDemoData(backend, ws)
                    await qc.invalidateQueries()
                    toast.success('Sample data added')
                  } catch (e) {
                    toast.error(errorMessage(e))
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                Add sample data
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] p-3">
            <div>
              <p className="text-sm font-medium text-destructive">Delete all my data</p>
              <p className="text-xs text-muted-foreground">Removes every row and file you own{session.mode === 'supabase' ? '. Your account stays.' : ' on this device.'}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setConfirmWipe(true)}>
              Delete data
            </Button>
          </div>
          {session.mode === 'supabase' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] p-3">
              <div>
                <p className="text-sm font-medium text-destructive">Delete my account</p>
                <p className="text-xs text-muted-foreground">Deletes your data, files and sign-in permanently.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setConfirmAccount(true)}>
                Delete account
              </Button>
            </div>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirmDemo}
        onOpenChange={setConfirmDemo}
        title="Remove all sample data?"
        description="Everything labelled “Demo” is deleted. Things you created yourself are kept."
        confirmLabel="Remove sample data"
        onConfirm={async () => {
          await removeDemoData(backend)
          await qc.invalidateQueries()
          toast.success('Sample data removed')
        }}
      />
      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="Delete all of your data?"
        description="Every item, idea, project, place, trip, journal entry and file is permanently deleted. Export first if you want a copy."
        requireText="DELETE"
        confirmLabel="Delete everything"
        onConfirm={async () => {
          await backend.wipe()
          if (session.mode === 'local') await backend.updateProfile({ ...profile, onboarded: false })
          else await backend.updateProfile({ onboarded: false, walkthrough_done: false })
          qc.clear()
          toast.success('All data deleted')
          navigate('/onboarding')
        }}
      />
      <ConfirmDialog
        open={confirmAccount}
        onOpenChange={setConfirmAccount}
        title="Delete your account?"
        description="Your data, files and login are deleted permanently. This can’t be undone."
        requireText="DELETE"
        confirmLabel="Delete my account"
        onConfirm={async () => {
          try {
            await (backend as SupabaseBackend).deleteAccount()
            await getSupabase()?.auth.signOut()
            qc.clear()
            navigate('/login')
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </div>
  )
}

export function ProfilePage() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const session = useSession()
  const backend = useBackend()
  const { upload, busy } = useUploader('orbit')
  const items = useRows('flip_items')
  const ideas = useRows('spark_ideas')
  const projects = useRows('spark_projects')
  const places = useRows('atlas_places')
  const trips = useRows('atlas_trips')
  const [name, setName] = React.useState(profile?.display_name ?? '')
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name])
  if (!profile) return null

  const counts = [
    ['Inventory items', items.data?.length ?? 0],
    ['Ideas', ideas.data?.length ?? 0],
    ['Projects', projects.data?.length ?? 0],
    ['Saved places', places.data?.length ?? 0],
    ['Trips', trips.data?.length ?? 0],
  ] as const

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader title="Profile" />
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar size={72} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
              <UserRound /> {profile.avatar_path ? 'Change photo' : 'Add a photo'}
            </Button>
            {profile.avatar_path && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  backend.removeFiles([profile.avatar_path!]).catch(() => undefined)
                  update.mutate({ avatar_path: null })
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Profile photo"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const [path] = await upload([f])
              if (!path) return
              if (profile.avatar_path) backend.removeFiles([profile.avatar_path]).catch(() => undefined)
              update.mutate({ avatar_path: path })
              toast.success('Profile photo updated')
            }}
          />
        </div>
        <form
          className="mt-5 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate({ display_name: name.trim() })
            toast.success('Name saved')
          }}
        >
          <Field label="Display name" htmlFor="pf-name" className="min-w-0 flex-1 basis-56">
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Button type="submit" variant="outline" disabled={name.trim() === profile.display_name}>
            Save
          </Button>
        </form>
        <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd>{session.user.email ?? 'Demo mode (no account)'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Member since</dt>
            <dd>{shortDate(profile.created_at)}</dd>
          </div>
        </dl>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Your Orbit</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {counts.map(([label, n]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold tabular">{n}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
