import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { LocalBackend, LOCAL_USER_ID } from '@/lib/backend/local'
import { SupabaseBackend } from '@/lib/backend/supabase'
import type { AuthUser, Backend } from '@/lib/backend/types'
import { supabaseConfigured } from '@/lib/config'
import { getSupabase } from '@/lib/supabase-client'

const DEMO_FLAG = 'orbit-demo-session'

export type SessionMode = 'supabase' | 'local'

export interface Session {
  mode: SessionMode
  user: AuthUser
  backend: Backend
}

interface AuthContextValue {
  status: 'loading' | 'signed-out' | 'signed-in'
  session: Session | null
  /** True after the person opens a password-reset link; they must set a new password. */
  recovering: boolean
  supabaseConfigured: boolean
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  startDemo(): void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

function readFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

let localBackend: LocalBackend | null = null
function getLocalBackend() {
  if (!localBackend) localBackend = new LocalBackend()
  return localBackend
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState<AuthContextValue['status']>('loading')
  const [session, setSession] = React.useState<Session | null>(null)
  const [recovering, setRecovering] = React.useState(false)

  React.useEffect(() => {
    const sb = getSupabase()
    if (!sb) {
      // No backend configured: only demo mode is available.
      if (readFlag()) {
        setSession({ mode: 'local', user: { id: LOCAL_USER_ID, email: null }, backend: getLocalBackend() })
        setStatus('signed-in')
      } else setStatus('signed-out')
      return
    }
    let cancelled = false
    const apply = (u: { id: string; email?: string | null } | null) => {
      if (cancelled) return
      if (u) {
        setSession((prev) =>
          prev?.user.id === u.id
            ? prev
            : { mode: 'supabase', user: { id: u.id, email: u.email ?? null }, backend: new SupabaseBackend(sb, u.id) },
        )
        setStatus('signed-in')
      } else {
        setSession(null)
        setStatus('signed-out')
      }
    }
    sb.auth.getSession().then(({ data }) => apply(data.session?.user ?? null))
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      apply(s?.user ?? null)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      recovering,
      supabaseConfigured,
      async signIn(email, password) {
        const sb = getSupabase()
        if (!sb) throw new Error('Accounts are not set up on this copy of Orbit yet.')
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password don’t match an account.' : error.message)
      },
      async signUp(email, password, displayName) {
        const sb = getSupabase()
        if (!sb) throw new Error('Accounts are not set up on this copy of Orbit yet.')
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        })
        if (error) throw new Error(error.message)
        return { needsConfirmation: !data.session }
      },
      async signOut() {
        const sb = getSupabase()
        if (session?.mode === 'local') {
          try {
            localStorage.removeItem(DEMO_FLAG)
          } catch {
            /* storage unavailable */
          }
          setSession(null)
          setStatus('signed-out')
        } else if (sb) {
          await sb.auth.signOut()
        }
        qc.clear()
      },
      async requestPasswordReset(email) {
        const sb = getSupabase()
        if (!sb) throw new Error('Accounts are not set up on this copy of Orbit yet.')
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL + 'update-password',
        })
        if (error) throw new Error(error.message)
      },
      async updatePassword(password) {
        const sb = getSupabase()
        if (!sb) throw new Error('Accounts are not set up on this copy of Orbit yet.')
        const { error } = await sb.auth.updateUser({ password })
        if (error) throw new Error(error.message)
        setRecovering(false)
      },
      startDemo() {
        try {
          localStorage.setItem(DEMO_FLAG, '1')
        } catch {
          /* storage unavailable: session lasts until reload */
        }
        setSession({ mode: 'local', user: { id: LOCAL_USER_ID, email: null }, backend: getLocalBackend() })
        setStatus('signed-in')
      },
    }),
    [status, session, recovering, qc],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('useSession needs a signed-in user')
  return session
}

export function useBackend(): Backend {
  return useSession().backend
}
