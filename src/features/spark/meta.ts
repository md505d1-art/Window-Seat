import * as React from 'react'
import type { IdeaStage, ProjectStatus, TaskPriority, TaskStatus } from '@/lib/types'

type Tone = 'neutral' | 'accent' | 'spark' | 'warning' | 'success' | 'outline' | 'atlas' | 'danger' | 'flip'

export const STAGE_META: Record<IdeaStage, { label: string; tone: Tone }> = {
  inbox: { label: 'Inbox', tone: 'neutral' },
  exploring: { label: 'Exploring', tone: 'atlas' },
  promising: { label: 'Promising', tone: 'spark' },
  converted: { label: 'Project', tone: 'success' },
}

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: Tone }> = {
  planning: { label: 'Planning', tone: 'neutral' },
  active: { label: 'Active', tone: 'spark' },
  paused: { label: 'Paused', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  archived: { label: 'Archived', tone: 'outline' },
}

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: Tone }> = {
  backlog: { label: 'Backlog', tone: 'outline' },
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'atlas' },
  in_review: { label: 'In review', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
}

export const PRIORITY_META: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: 'Low', tone: 'outline' },
  medium: { label: 'Medium', tone: 'neutral' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
}

export const PROJECT_COLORS: Record<string, string> = {
  violet: 'var(--spark)',
  emerald: 'var(--flip)',
  sky: 'var(--atlas)',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
}

/** Saves a value shortly after it stops changing. Returns the current save state. */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, delay = 700) {
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const first = React.useRef(true)
  const latest = React.useRef(save)
  latest.current = save
  const serialised = JSON.stringify(value)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setState('saving')
    const t = setTimeout(() => {
      latest
        .current(JSON.parse(serialised) as T)
        .then(() => setState('saved'))
        .catch(() => setState('error'))
    }, delay)
    return () => clearTimeout(t)
  }, [serialised, delay])
  return state
}

export function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const text = { idle: '', saving: 'Saving…', saved: 'All changes saved', error: 'Couldn’t save — check your connection' }[state]
  return React.createElement(
    'span',
    { className: state === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground', 'aria-live': 'polite' },
    text,
  )
}
