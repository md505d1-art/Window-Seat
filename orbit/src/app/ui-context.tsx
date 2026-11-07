import * as React from 'react'

/** Global dialogs that can be opened from anywhere (top bar, command palette, dashboard). */
export type GlobalDialog = 'capture-idea' | 'new-task' | 'new-project' | 'new-trip' | 'palette' | 'customise-dashboard'

export interface DialogProps {
  projectId?: string
  ideaId?: string
  title?: string
  description?: string
  module?: 'spark' | 'flip' | 'atlas' | 'general'
}

interface UIContextValue {
  dialog: GlobalDialog | null
  dialogProps: DialogProps
  open: (d: GlobalDialog, props?: DialogProps) => void
  close: () => void
  crumbTitle: string | undefined
  setCrumbTitle: (t: string | undefined) => void
}

const UIContext = React.createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = React.useState<GlobalDialog | null>(null)
  const [dialogProps, setDialogProps] = React.useState<DialogProps>({})
  const [crumbTitle, setCrumbTitle] = React.useState<string | undefined>()
  const value = React.useMemo(
    () => ({
      dialog,
      dialogProps,
      open: (d: GlobalDialog, props: DialogProps = {}) => {
        setDialogProps(props)
        setDialog(d)
      },
      close: () => setDialog(null),
      crumbTitle,
      setCrumbTitle,
    }),
    [dialog, dialogProps, crumbTitle],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = React.useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}

/** Lets a detail page name the last breadcrumb (e.g. the item's title instead of its id). */
export function useCrumbTitle(title: string | undefined) {
  const { setCrumbTitle } = useUI()
  React.useEffect(() => {
    setCrumbTitle(title)
    return () => setCrumbTitle(undefined)
  }, [title, setCrumbTitle])
}

export function useDialogState(name: GlobalDialog) {
  const { dialog, open, close } = useUI()
  return {
    open: dialog === name,
    onOpenChange: (o: boolean) => (o ? open(name) : close()),
  }
}
