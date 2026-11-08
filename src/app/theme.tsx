import * as React from 'react'

export type ThemePref = 'dark' | 'light' | 'system'
const KEY = 'orbit-theme'

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'dark'
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0D12' : '#F6F7F9')
}

const ThemeContext = React.createContext<{ theme: ThemePref; setTheme: (t: ThemePref) => void; resolved: 'dark' | 'light' } | null>(
  null,
)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePref>(read)
  const [resolved, setResolved] = React.useState<'dark' | 'light'>('dark')

  React.useEffect(() => {
    apply(theme)
    setResolved(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      apply('system')
      setResolved(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = React.useCallback((t: ThemePref) => {
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* storage unavailable */
    }
    setThemeState(t)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
