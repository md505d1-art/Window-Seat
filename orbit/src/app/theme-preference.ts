import * as React from 'react'
import { useProfile, useUpdateProfile } from '@/lib/data'
import { useTheme, type ThemePref } from './theme'

/** Changes the theme on this device and remembers it on the account. */
export function useThemePreference() {
  const { theme, setTheme, resolved } = useTheme()
  const update = useUpdateProfile()
  return {
    theme,
    resolved,
    set(t: ThemePref) {
      setTheme(t)
      update.mutate({ theme: t })
    },
  }
}

/** On sign-in, apply the theme saved on the account (once per session). */
export function useApplyAccountTheme() {
  const { data: profile } = useProfile()
  const { theme, setTheme } = useTheme()
  const done = React.useRef(false)
  React.useEffect(() => {
    if (done.current || !profile) return
    done.current = true
    if (profile.theme && profile.theme !== theme) setTheme(profile.theme)
  }, [profile, theme, setTheme])
}
