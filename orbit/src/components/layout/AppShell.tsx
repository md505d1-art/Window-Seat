import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  Bell,
  ChevronRight,
  Lightbulb,
  ListChecks,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Plus,
  Rocket,
  Search,
  Settings,
  Sun,
  User,
  BookOpen,
} from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { crumbsFor, HOME_NAV, MODULES, moduleForPath, TASKS_NAV, type NavLeaf } from '@/app/nav'
import { useTheme } from '@/app/theme'
import { useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { SheetContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/ui/menu'
import { Badge, Kbd } from '@/components/ui/misc'
import { useAuth, useSession } from '@/features/auth/auth'
import { useWorkspaces } from '@/features/shared/workspaces'
import { useFileUrls, useProfile, useRows } from '@/lib/data'
import { cn } from '@/lib/utils'
import { CommandPalette } from './CommandPalette'
import { GlobalDialogs } from './GlobalDialogs'
import { NotificationsMenu } from './NotificationsMenu'
import { Walkthrough } from '@/features/onboarding/Walkthrough'
import { useBackgroundNotifications } from '@/features/shared/background'

const COLLAPSE_KEY = 'orbit-sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function Avatar({ size = 28 }: { size?: number }) {
  const { data: profile } = useProfile()
  const session = useSession()
  const paths = profile?.avatar_path ? [profile.avatar_path] : []
  const urls = useFileUrls(paths)
  const url = profile?.avatar_path ? urls.data?.[profile.avatar_path] : undefined
  const name = profile?.display_name || session.user.email || 'You'
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')
  return url ? (
    <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--atlas))] text-[11px] font-semibold text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials || 'O'}
    </span>
  )
}

function NavItem({ item, collapsed, accent, onNavigate, badge }: { item: NavLeaf; collapsed: boolean; accent?: string; onNavigate?: () => void; badge?: number }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
          isActive && 'bg-surface-2 text-foreground',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className="size-4 shrink-0" style={isActive && accent ? { color: accent } : undefined} aria-hidden />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && badge ? (
            <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-white">{badge}</span>
          ) : null}
          {collapsed && badge ? <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" /> : null}
          {collapsed && <span className="sr-only">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const ws = useWorkspaces()
  const { data: profile } = useProfile()
  const session = useSession()
  const unread = useRows('notifications', { eq: { read_at: null } })
  const unreadCount = unread.data?.length ?? 0

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto px-2.5 pb-3 scrollbar-thin">
      <nav aria-label="Main" className="grid gap-0.5">
        <NavItem item={HOME_NAV} collapsed={collapsed} onNavigate={onNavigate} />
        {MODULES.filter((m) => ws[m.id]).map((m) => {
          const active = pathname.startsWith(m.to)
          const accent = `var(--${m.id})`
          return (
            <div key={m.id} data-tour={m.id} className="grid gap-0.5">
              <NavItem item={{ label: m.label, to: m.to, icon: m.icon }} collapsed={collapsed} accent={accent} onNavigate={onNavigate} />
              {active && !collapsed && (
                <div className="ml-[18px] grid gap-0.5 border-l border-border pl-2">
                  {m.items.map((it) => (
                    <NavItem key={it.to} item={it} collapsed={false} accent={accent} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <NavItem item={TASKS_NAV} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      <div className="my-2 h-px bg-border" />

      <nav aria-label="Tools" className="grid gap-0.5">
        <NavItem item={{ label: 'Search', to: '/search', icon: Search }} collapsed={collapsed} onNavigate={onNavigate} />
        <NavItem item={{ label: 'Notifications', to: '/notifications', icon: Bell }} collapsed={collapsed} onNavigate={onNavigate} badge={unreadCount} />
        <NavItem item={{ label: 'Settings', to: '/settings', icon: Settings }} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      <div className="mt-auto grid gap-2 pt-4">
        {session.mode === 'local' && !collapsed && (
          <Link
            to="/settings#backend"
            onClick={onNavigate}
            className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-2.5 text-xs leading-snug"
          >
            <span className="font-semibold text-warning">Demo mode</span>
            <span className="block text-muted-foreground">Data stays in this browser. Connect Supabase to sync and sign in.</span>
          </Link>
        )}
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn('flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-surface-2', isActive && 'bg-surface-2', collapsed && 'justify-center')
          }
        >
          <Avatar />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{profile?.display_name || 'Your profile'}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{session.user.email ?? 'Demo account'}</span>
            </span>
          )}
          {collapsed && <span className="sr-only">Profile</span>}
        </NavLink>
      </div>
    </div>
  )
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 font-semibold tracking-tight', collapsed && 'justify-center')} aria-label="Orbit home">
      <img src={`${import.meta.env.BASE_URL}orbit.svg`} alt="" className="size-7 rounded-lg" />
      {!collapsed && <span className="text-[15px]">Orbit</span>}
    </Link>
  )
}

function ThemeMenu() {
  const { theme, setTheme, resolved } = useTheme()
  const Icon = resolved === 'dark' ? Moon : Sun
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {(
          [
            ['dark', 'Dark', Moon],
            ['light', 'Light', Sun],
            ['system', 'Match system', Monitor],
          ] as const
        ).map(([v, label, I]) => (
          <DropdownMenuItem key={v} onSelect={() => setTheme(v)} className={theme === v ? 'font-semibold' : ''}>
            <I /> {label}
            {theme === v && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NewMenu() {
  const navigate = useNavigate()
  const { open } = useUI()
  const ws = useWorkspaces()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" aria-label="Create new">
          <Plus /> <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        {ws.flip && (
          <DropdownMenuItem onSelect={() => navigate('/flip/items/new')}>
            <Package /> Inventory item
          </DropdownMenuItem>
        )}
        {ws.spark && (
          <>
            <DropdownMenuItem onSelect={() => open('capture-idea')}>
              <Lightbulb /> Idea
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('new-project')}>
              <Rocket /> Project
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => open('new-task')}>
          <ListChecks /> Task
        </DropdownMenuItem>
        {ws.atlas && (
          <>
            <DropdownMenuItem onSelect={() => open('new-trip')}>
              <Plane /> Trip
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/atlas/journal?new=1')}>
              <BookOpen /> Journal entry
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountMenu() {
  const { signOut } = useAuth()
  const session = useSession()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full" aria-label="Account menu">
          <Avatar size={30} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{profile?.display_name || 'You'}</span>
          <span className="block truncate">{session.user.email ?? 'Demo account on this device'}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut()
            navigate('/login')
          }}
        >
          <LogOut /> {session.mode === 'local' ? 'Leave demo' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const { crumbTitle } = useUI()
  const crumbs = crumbsFor(pathname, crumbTitle)
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={c.to + i} className={cn('flex min-w-0 items-center gap-1', !last && i > 0 && 'hidden md:flex', i === 0 && crumbs.length > 1 && 'hidden sm:flex')}>
              {i > 0 && <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground/60', last && 'hidden sm:block')} aria-hidden />}
              {last ? (
                <span aria-current="page" className="truncate font-medium">
                  {c.label}
                </span>
              ) : (
                <Link to={c.to} className="truncate text-muted-foreground hover:text-foreground">
                  {c.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { open } = useUI()
  const { pathname } = useLocation()
  const session = useSession()
  const module = moduleForPath(pathname)
  useBackgroundNotifications()

  React.useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open('palette')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Scroll to top on navigation, like a normal page load.
  React.useEffect(() => {
    document.getElementById('orbit-main')?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className={cn('flex h-dvh overflow-hidden', `module-${module}`)}>
      <a href="#orbit-main" className="sr-only z-50 rounded bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-[color-mix(in_oklab,var(--background)_70%,var(--surface))] transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[60px]' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center px-4', collapsed ? 'justify-center px-0' : 'justify-between')}>
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar">
              <PanelLeftClose />
            </Button>
          )}
        </div>
        {collapsed && (
          <div className="flex justify-center pb-2">
            <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(false)} aria-label="Expand sidebar">
              <PanelLeftOpen />
            </Button>
          </div>
        )}
        <SidebarBody collapsed={collapsed} />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" title="Navigation" className="w-72 pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center px-4">
            <Brand collapsed={false} />
          </div>
          <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 pr-[max(12px,env(safe-area-inset-right))] pl-[max(12px,env(safe-area-inset-left))] backdrop-blur sm:gap-3 lg:pl-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          {session.mode === 'local' && (
            <Badge tone="warning" className="hidden md:inline-flex">
              Demo mode
            </Badge>
          )}
          <button
            onClick={() => open('palette')}
            className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:flex"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => open('palette')} aria-label="Search">
            <Search />
          </Button>
          <NewMenu />
          <ThemeMenu />
          <NotificationsMenu />
          <AccountMenu />
        </header>
        <main id="orbit-main" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1400px] pt-5 pr-[max(16px,env(safe-area-inset-right))] pb-16 pl-[max(16px,env(safe-area-inset-left))] sm:pt-7 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette />
      <GlobalDialogs />
      <Walkthrough />
    </div>
  )
}
