import { ImagePlus, LoaderCircle, Star, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { useBackend } from '@/features/auth/auth'
import { useFileUrls } from '@/lib/data'
import type { ModuleId } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'

const MAX_EDGE = 1600
const MAX_BYTES = 15 * 1024 * 1024

/** Downscales large photos before upload so storage stays small and pages stay fast. */
export async function prepareImage(file: File, maxEdge = MAX_EDGE): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.86))
  } catch {
    return file
  }
}

/** Base64 (no data: prefix) of a downscaled JPEG, for sending photos to the AI service. */
export async function imageToBase64(blob: Blob, maxEdge = 1024): Promise<{ data: string; media_type: string }> {
  const prepared = blob instanceof File ? await prepareImage(blob, maxEdge) : blob
  const buf = new Uint8Array(await prepared.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return { data: btoa(bin), media_type: prepared.type || 'image/jpeg' }
}

export function useUploader(module: ModuleId) {
  const backend = useBackend()
  const [busy, setBusy] = React.useState(false)
  const upload = async (files: FileList | File[]): Promise<string[]> => {
    const list = Array.from(files)
    const tooBig = list.filter((f) => f.size > MAX_BYTES)
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} over 15 MB and wasn’t added.`)
    setBusy(true)
    try {
      const paths: string[] = []
      for (const f of list.filter((x) => x.size <= MAX_BYTES)) {
        const blob = f.type.startsWith('image/') ? await prepareImage(f) : f
        const name = f.type.startsWith('image/') && blob !== f ? f.name.replace(/\.[^.]+$/, '') + '.jpg' : f.name
        paths.push(await backend.upload(module, blob, name))
      }
      return paths
    } catch (e) {
      toast.error(errorMessage(e))
      return []
    } finally {
      setBusy(false)
    }
  }
  return { upload, busy }
}

export function Thumb({ path, className, alt = '' }: { path: string | undefined; className?: string; alt?: string }) {
  const urls = useFileUrls(path ? [path] : [])
  const url = path ? urls.data?.[path] : undefined
  return url ? (
    <img src={url} alt={alt} className={cn('object-cover', className)} loading="lazy" />
  ) : (
    <div className={cn('bg-surface-2', className)} aria-hidden />
  )
}

/** Multi-photo picker: add, remove, and pick the cover photo (the first one). */
export function PhotoUploader({
  module,
  value,
  onChange,
  max = 12,
  label = 'Photos',
}: {
  module: ModuleId
  value: string[]
  onChange: (paths: string[]) => void
  max?: number
  label?: string
}) {
  const { upload, busy } = useUploader(module)
  const backend = useBackend()
  const urls = useFileUrls(value)
  const input = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)

  const add = async (files: FileList | File[]) => {
    const room = max - value.length
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room)
    if (!list.length) return
    const paths = await upload(list)
    if (paths.length) onChange([...value, ...paths])
  }

  return (
    <div>
      <div
        className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6', dragOver && 'rounded-xl ring-2 ring-accent')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          add(e.dataTransfer.files)
        }}
      >
        {value.map((p, i) => (
          <div key={p} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2">
            {urls.data?.[p] ? <img src={urls.data[p]} alt={`${label} ${i + 1}`} className="size-full object-cover" /> : <div className="skeleton size-full" />}
            {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Cover</span>}
            <div className="absolute inset-x-1 top-1 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {i > 0 ? (
                <button
                  type="button"
                  className="grid size-6 place-items-center rounded-md bg-black/60 text-white"
                  onClick={() => onChange([p, ...value.filter((x) => x !== p)])}
                  aria-label={`Make photo ${i + 1} the cover`}
                  title="Make cover"
                >
                  <Star className="size-3.5" />
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="grid size-6 place-items-center rounded-md bg-black/60 text-white"
                onClick={() => {
                  onChange(value.filter((x) => x !== p))
                  backend.removeFiles([p]).catch(() => undefined)
                }}
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="grid aspect-square place-items-center rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            disabled={busy}
          >
            <span className="grid justify-items-center gap-1 text-xs">
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              {busy ? 'Uploading…' : 'Add photos'}
            </span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label={`Add ${label.toLowerCase()}`}
        onChange={(e) => {
          if (e.target.files) add(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Drag photos here or tap Add. The first photo is the cover. Up to {max}.
      </p>
    </div>
  )
}
