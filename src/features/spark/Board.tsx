import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as React from 'react'
import { Badge } from '@/components/ui/misc'
import { cn, positionBetween } from '@/lib/utils'

export interface BoardColumn<C extends string> {
  id: C
  label: string
  tone?: React.ComponentProps<typeof Badge>['tone']
}

interface BoardProps<T extends { id: string }, C extends string> {
  columns: BoardColumn<C>[]
  items: T[]
  columnOf: (item: T) => C
  positionOf?: (item: T) => number
  renderCard: (item: T, dragging: boolean) => React.ReactNode
  onMove: (item: T, column: C, position: number) => void
  footer?: (column: C) => React.ReactNode
  label: string
  /** Name read out to screen readers while a card is moved. */
  labelOf?: (item: T) => string
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-manipulation rounded-xl', isDragging && 'opacity-30')}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        // Space picks the card up (drag sensor); Enter opens it.
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.currentTarget.firstElementChild as HTMLElement | null)?.click()
          return
        }
        listeners?.onKeyDown?.(e)
      }}
    >
      {children}
    </div>
  )
}

function Column<C extends string>({ col, count, children, footer }: { col: BoardColumn<C>; count: number; children: React.ReactNode; footer?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.id}` })
  return (
    <section
      aria-label={`${col.label}, ${count} item${count === 1 ? '' : 's'}`}
      className={cn('flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-surface/60 transition-colors', isOver && 'border-accent bg-[color-mix(in_oklab,var(--accent)_6%,var(--surface))]')}
    >
      <header className="flex items-center justify-between px-3 pt-3 pb-2">
        <Badge tone={col.tone}>{col.label}</Badge>
        <span className="text-xs text-muted-foreground tabular">{count}</span>
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {children}
      </div>
      {footer && <div className="px-2 pb-2">{footer}</div>}
    </section>
  )
}

/**
 * Drag-and-drop board. Works with mouse, touch and keyboard (focus a card, press Space,
 * move with arrow keys, Space again to drop).
 */
export function Board<T extends { id: string }, C extends string>({ columns, items, columnOf, positionOf, renderCard, onMove, footer, label, labelOf }: BoardProps<T, C>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const byCol = React.useMemo(() => {
    const m = new Map<C, T[]>()
    for (const c of columns) m.set(c.id, [])
    for (const it of items) m.get(columnOf(it))?.push(it)
    if (positionOf) for (const list of m.values()) list.sort((a, b) => positionOf(a) - positionOf(b))
    return m
  }, [items, columns, columnOf, positionOf])

  const findColumn = (id: string): C | undefined => {
    if (id.startsWith('col:')) return id.slice(4) as C
    const it = items.find((i) => i.id === id)
    return it ? columnOf(it) : undefined
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const active = items.find((i) => i.id === e.active.id)
    if (!active || !e.over) return
    const overId = String(e.over.id)
    const target = findColumn(overId)
    if (!target) return
    const list = (byCol.get(target) ?? []).filter((i) => i.id !== active.id)
    let index = list.length
    if (!overId.startsWith('col:')) {
      const overIndex = list.findIndex((i) => i.id === overId)
      if (overIndex >= 0) {
        // Dropping on a card in the same column after its own position means "after it".
        const sameCol = columnOf(active) === target
        const originalIndex = (byCol.get(target) ?? []).findIndex((i) => i.id === active.id)
        const overOriginal = (byCol.get(target) ?? []).findIndex((i) => i.id === overId)
        index = sameCol && originalIndex < overOriginal ? overIndex + 1 : overIndex
      }
    }
    const pos = positionOf ? positionBetween(list[index - 1] ? positionOf(list[index - 1]) : undefined, list[index] ? positionOf(list[index]) : undefined) : 0
    if (columnOf(active) === target && positionOf && positionOf(active) === pos) return
    onMove(active, target, pos)
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : undefined
  const name = (id: string) => {
    const it = items.find((i) => i.id === id)
    return it && labelOf ? labelOf(it) : 'Card'
  }
  const colName = (id: string) => {
    const c = findColumn(id)
    return columns.find((x) => x.id === c)?.label ?? 'a column'
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: 'Press Enter to open this card. To move it, press Space, use the arrow keys, then press Space again to drop it, or Escape to cancel.' },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${name(String(active.id))}.`,
          onDragOver: ({ active, over }) => (over ? `${name(String(active.id))} is over ${colName(String(over.id))}.` : `${name(String(active.id))} is not over a column.`),
          onDragEnd: ({ active, over }) => (over ? `Dropped ${name(String(active.id))} in ${colName(String(over.id))}.` : `${name(String(active.id))} was put back.`),
          onDragCancel: ({ active }) => `Cancelled. ${name(String(active.id))} was put back.`,
        },
      }}
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 scrollbar-thin" role="group" aria-label={label}>
        {columns.map((col) => {
          const list = byCol.get(col.id) ?? []
          return (
            <Column key={col.id} col={col} count={list.length} footer={footer?.(col.id)}>
              <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {list.map((it) => (
                  <SortableCard key={it.id} id={it.id}>
                    {renderCard(it, false)}
                  </SortableCard>
                ))}
              </SortableContext>
            </Column>
          )
        })}
      </div>
      <DragOverlay dropAnimation={null}>{activeItem ? <div className="rotate-1 shadow-card">{renderCard(activeItem, true)}</div> : null}</DragOverlay>
    </DndContext>
  )
}
