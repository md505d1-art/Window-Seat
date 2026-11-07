import * as React from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation, useRouteError } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ListSkeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth'
import { LoginPage, ResetPasswordPage, SignupPage, UpdatePasswordPage } from '@/features/auth/AuthPages'
import { HomePage } from '@/features/home/HomePage'
import { OnboardingPage } from '@/features/onboarding/Onboarding'
import { WorkspaceGate } from '@/features/shared/workspaces'
import { useProfile } from '@/lib/data'

const flip = () => import('@/features/flip')
const spark = () => import('@/features/spark')
const atlas = () => import('@/features/atlas')
const shared = () => import('@/features/shared/pages')
const settings = () => import('@/features/settings')

function lazyPage<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M & string) {
  const C = React.lazy(async () => ({ default: (await loader())[name] as React.ComponentType }))
  return function LazyPage() {
    return (
      <React.Suspense fallback={<ListSkeleton rows={5} />}>
        <C />
      </React.Suspense>
    )
  }
}

function Splash() {
  return (
    <div className="grid h-dvh place-items-center" role="status" aria-label="Loading Orbit">
      <img src={`${import.meta.env.BASE_URL}orbit.svg`} alt="" className="size-10 animate-pulse rounded-xl" />
    </div>
  )
}

function RequireAuth() {
  const { status, recovering } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (recovering) return <Navigate to="/update-password" replace />
  return <Outlet />
}

function RequireOnboarded() {
  const { data, isLoading, error } = useProfile()
  if (isLoading) return <Splash />
  if (error) return <RouteError error={error} />
  if (data && !data.onboarded) return <Navigate to="/onboarding" replace />
  return <AppShell />
}

function RouteError({ error }: { error?: unknown }) {
  const routeError = useRouteError()
  const e = error ?? routeError
  const message = e instanceof Error ? e.message : 'This page could not be shown.'
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Reload Orbit
        </Button>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">That link doesn’t go anywhere in Orbit.</p>
        <Button asChild className="mt-4">
          <a href={import.meta.env.BASE_URL}>Go home</a>
        </Button>
      </div>
    </div>
  )
}

const gate = (module: 'flip' | 'spark' | 'atlas', Page: React.ComponentType) =>
  function Gated() {
    return (
      <WorkspaceGate module={module}>
        <Page />
      </WorkspaceGate>
    )
  }

export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    { path: '/signup', element: <SignupPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> },
    { path: '/update-password', element: <UpdatePasswordPage /> },
    {
      element: <RequireAuth />,
      errorElement: <RouteError />,
      children: [
        { path: '/onboarding', element: <OnboardingPage /> },
        {
          element: <RequireOnboarded />,
          errorElement: <RouteError />,
          children: [
            { path: '/', element: <HomePage /> },
            { path: '/flip', Component: gate('flip', lazyPage(flip, 'InventoryPage')) },
            { path: '/flip/items/new', Component: gate('flip', lazyPage(flip, 'ItemEditorPage')) },
            { path: '/flip/items/:id', Component: gate('flip', lazyPage(flip, 'ItemEditorPage')) },
            { path: '/flip/listing', Component: gate('flip', lazyPage(flip, 'ListingAssistantPage')) },
            { path: '/flip/sales', Component: gate('flip', lazyPage(flip, 'SalesPage')) },
            { path: '/spark', Component: gate('spark', lazyPage(spark, 'IdeasPage')) },
            { path: '/spark/ideas/:id', Component: gate('spark', lazyPage(spark, 'IdeaDetailPage')) },
            { path: '/spark/projects', Component: gate('spark', lazyPage(spark, 'ProjectsPage')) },
            { path: '/spark/projects/:id', Component: gate('spark', lazyPage(spark, 'ProjectPage')) },
            { path: '/spark/canvas', Component: gate('spark', lazyPage(spark, 'CanvasListPage')) },
            { path: '/spark/canvas/:id', Component: gate('spark', lazyPage(spark, 'CanvasPage')) },
            { path: '/spark/assistant', Component: gate('spark', lazyPage(spark, 'AssistantPage')) },
            { path: '/atlas', Component: gate('atlas', lazyPage(atlas, 'PlacesPage')) },
            { path: '/atlas/map', Component: gate('atlas', lazyPage(atlas, 'MapPage')) },
            { path: '/atlas/trips', Component: gate('atlas', lazyPage(atlas, 'TripsPage')) },
            { path: '/atlas/trips/:id', Component: gate('atlas', lazyPage(atlas, 'TripPage')) },
            { path: '/atlas/journal', Component: gate('atlas', lazyPage(atlas, 'JournalPage')) },
            { path: '/atlas/stats', Component: gate('atlas', lazyPage(atlas, 'StatsPage')) },
            { path: '/tasks', Component: lazyPage(shared, 'TasksPage') },
            { path: '/search', Component: lazyPage(shared, 'SearchPage') },
            { path: '/notifications', Component: lazyPage(shared, 'NotificationsPage') },
            { path: '/settings', Component: lazyPage(settings, 'SettingsPage') },
            { path: '/profile', Component: lazyPage(settings, 'ProfilePage') },
            { path: '*', element: <NotFound /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
