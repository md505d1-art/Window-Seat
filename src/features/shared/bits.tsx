import { Compass, Sparkles, Star, Tag, type LucideIcon } from 'lucide-react'
import type { ModuleId } from '@/lib/types'
import { cn } from '@/lib/utils'

export const MODULE_META: Record<ModuleId, { label: string; icon: LucideIcon; color: string }> = {
  flip: { label: 'Flip', icon: Tag, color: 'var(--flip)' },
  spark: { label: 'Spark', icon: Sparkles, color: 'var(--spark)' },
  atlas: { label: 'Atlas', icon: Compass, color: 'var(--atlas)' },
  orbit: { label: 'Orbit', icon: Sparkles, color: 'var(--primary)' },
}

export function ModuleDot({ module, className }: { module: ModuleId; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: MODULE_META[module].color }} aria-hidden />
}

export function ModuleIcon({ module, className }: { module: ModuleId; className?: string }) {
  const { icon: Icon, color, label } = MODULE_META[module]
  return (
    <span
      className={cn('grid size-7 shrink-0 place-items-center rounded-lg', className)}
      style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
      title={label}
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  )
}

export function FavouriteButton({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      className={cn('rounded-md p-1 transition-colors hover:bg-surface-2', on ? 'text-amber-400' : 'text-muted-foreground')}
    >
      <Star className="size-4" fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}
