import { Link } from 'react-router'
import { Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { useProfile, useUpdateProfile } from '@/lib/data'
import type { ModuleId } from '@/lib/types'

export function useWorkspaces() {
  const { data } = useProfile()
  return data?.workspaces ?? { flip: true, spark: true, atlas: true }
}

const NAMES = { flip: 'Flip', spark: 'Spark', atlas: 'Atlas' } as const

/** Wraps a workspace route; shows a switch-on prompt when that workspace is turned off. */
export function WorkspaceGate({ module, children }: { module: Exclude<ModuleId, 'orbit'>; children: React.ReactNode }) {
  const ws = useWorkspaces()
  const profile = useProfile()
  const update = useUpdateProfile()
  if (profile.isLoading || ws[module]) return <div className={`module-${module}`}>{children}</div>
  return (
    <div className={`module-${module}`}>
      <EmptyState
        icon={Power}
        title={`${NAMES[module]} is turned off`}
        description="Turn this workspace on to see it in your sidebar, dashboard and search. Your data is kept while it is off."
        action={
          <div className="flex gap-2">
            <Button
              variant="accent"
              onClick={() => update.mutate({ workspaces: { ...ws, [module]: true } })}
              loading={update.isPending}
            >
              Turn on {NAMES[module]}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/settings">Settings</Link>
            </Button>
          </div>
        }
      />
    </div>
  )
}
