import { Compass, Database, Sparkles, Tag } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/inputs'
import { errorMessage } from '@/lib/utils'
import { useAuth } from './auth'

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,520px)]">
      <section className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]" />
        <div className="relative flex items-center gap-2 font-semibold">
          <img src={`${import.meta.env.BASE_URL}orbit.svg`} alt="" className="size-8 rounded-lg" /> Orbit
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">Your work, ideas and adventures, in one orbit.</h2>
          <ul className="mt-8 grid gap-4 text-sm">
            {[
              { icon: Tag, color: 'var(--flip)', name: 'Flip', text: 'Track stock, write listings and see real profit after fees.' },
              { icon: Sparkles, color: 'var(--spark)', name: 'Spark', text: 'Capture ideas and turn the good ones into planned projects.' },
              { icon: Compass, color: 'var(--atlas)', name: 'Atlas', text: 'Save places, plan trips day by day and keep a travel journal.' },
            ].map((m) => (
              <li key={m.name} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${m.color} 16%, transparent)`, color: m.color }}>
                  <m.icon className="size-4" />
                </span>
                <span>
                  <span className="font-medium">{m.name}</span>
                  <span className="block text-muted-foreground">{m.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Your data is private to your account.</p>
      </section>
      <section className="flex items-center justify-center px-[max(16px,env(safe-area-inset-left))] py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 font-semibold lg:hidden">
            <img src={`${import.meta.env.BASE_URL}orbit.svg`} alt="" className="size-8 rounded-lg" /> Orbit
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </div>
  )
}

/** Shown when no Supabase project is configured: honest about it, with a way to try Orbit. */
function NotConfigured() {
  const { startDemo } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Database className="size-4 text-muted-foreground" /> Accounts aren’t connected yet
        </p>
        <p className="mt-1.5 text-muted-foreground">
          This copy of Orbit has no Supabase project configured, so sign-up and sign-in are switched off. Add
          <code className="mx-1 rounded bg-surface-2 px-1 font-mono text-xs">VITE_SUPABASE_URL</code>and
          <code className="mx-1 rounded bg-surface-2 px-1 font-mono text-xs">VITE_SUPABASE_ANON_KEY</code>
          to enable accounts. The setup steps are in the project README.
        </p>
      </div>
      <Button
        size="lg"
        onClick={() => {
          startDemo()
          navigate('/')
        }}
      >
        Explore Orbit in demo mode
      </Button>
      <p className="text-xs text-muted-foreground">
        Demo mode keeps everything in this browser only. Nothing is uploaded, and clearing your browser data removes it.
      </p>
    </div>
  )
}

function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const { status, recovering } = useAuth()
  if (status === 'signed-in' && !recovering) return <Navigate to="/" replace />
  return <>{children}</>
}

export function LoginPage() {
  const { signIn, supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  return (
    <RedirectIfSignedIn>
      <AuthLayout title="Welcome back" subtitle={supabaseConfigured ? 'Sign in to your Orbit account.' : 'Orbit is ready to explore.'}>
        {!supabaseConfigured ? (
          <NotConfigured />
        ) : (
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError('')
              try {
                await signIn(email.trim(), password)
                navigate('/')
              } catch (err) {
                setError(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy}>
              Sign in
            </Button>
            <div className="flex justify-between text-sm">
              <Link to="/reset-password" className="text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
              <Link to="/signup" className="font-medium text-primary-text">
                Create an account
              </Link>
            </div>
          </form>
        )}
      </AuthLayout>
    </RedirectIfSignedIn>
  )
}

export function SignupPage() {
  const { signUp, supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [sent, setSent] = React.useState(false)

  return (
    <RedirectIfSignedIn>
      <AuthLayout title="Create your Orbit" subtitle="One account for Flip, Spark and Atlas.">
        {!supabaseConfigured ? (
          <NotConfigured />
        ) : sent ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-muted-foreground">We sent a confirmation link to {email}. Open it to finish creating your account.</p>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (password.length < 8) {
                setError('Use at least 8 characters for your password.')
                return
              }
              setBusy(true)
              setError('')
              try {
                const { needsConfirmation } = await signUp(email.trim(), password, name.trim())
                if (needsConfirmation) setSent(true)
                else navigate('/onboarding')
              } catch (err) {
                setError(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            <Field label="Your name" htmlFor="name">
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password" hint="At least 8 characters.">
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy}>
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-text">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </AuthLayout>
    </RedirectIfSignedIn>
  )
}

export function ResetPasswordPage() {
  const { requestPasswordReset, supabaseConfigured } = useAuth()
  const [email, setEmail] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState('')
  return (
    <AuthLayout title="Reset your password" subtitle="We’ll email you a link to choose a new one.">
      {!supabaseConfigured ? (
        <NotConfigured />
      ) : sent ? (
        <div className="grid gap-4">
          <p className="rounded-xl border border-border bg-surface p-4 text-sm">If an account exists for {email}, a reset link is on its way.</p>
          <Link to="/login" className="text-sm font-medium text-primary-text">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              await requestPasswordReset(email.trim())
              setSent(true)
            } catch (err) {
              setError(errorMessage(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={busy}>
            Send reset link
          </Button>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}

export function UpdatePasswordPage() {
  const { updatePassword, status } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  return (
    <AuthLayout title="Choose a new password" subtitle="You’ll stay signed in on this device.">
      {status !== 'signed-in' ? (
        <p className="text-sm text-muted-foreground">
          This link has expired or was already used.{' '}
          <Link to="/reset-password" className="font-medium text-primary-text">
            Request a new one
          </Link>
          .
        </p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (password.length < 8) {
              setError('Use at least 8 characters.')
              return
            }
            setBusy(true)
            try {
              await updatePassword(password)
              toast.success('Password updated')
              navigate('/')
            } catch (err) {
              setError(errorMessage(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="New password" htmlFor="password" hint="At least 8 characters.">
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={busy}>
            Save password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
