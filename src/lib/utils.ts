import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return crypto.randomUUID()
}

/** Turns an unknown thrown value into a sentence a person can act on. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string') return e
  return 'Something went wrong. Please try again.'
}

export function downloadFile(filename: string, content: BlobPart, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers that refuse the async clipboard API.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Fractional position between two neighbours, for drag-and-drop ordering without renumbering. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1000
  if (before === undefined) return (after as number) - 1000
  if (after === undefined) return before + 1000
  return (before + after) / 2
}

export function pluralise(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
