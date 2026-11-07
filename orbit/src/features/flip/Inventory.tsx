import { Archive, ArchiveRestore, Copy, Download, Ellipsis, FileUp, Package, Pencil, Plus, Search, Trash, WandSparkles } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Checkbox, Input, Select } from '@/components/ui/inputs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu'
import { Badge, DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/misc'
import { FavouriteButton } from '@/features/shared/bits'
import { Thumb } from '@/features/shared/PhotoUploader'
import { useBackend } from '@/features/auth/auth'
import { invalidate, useLogActivity, useProfile, useRows } from '@/lib/data'
import { itemsToCsv, parseItemsCsv, type CsvImportResult } from '@/lib/csv'
import { netProfit } from '@/lib/finance'
import { money, shortDate, todayISO } from '@/lib/format'
import { FLIP_STATUSES, type FlipItem, type FlipStatus } from '@/lib/types'
import { cn, downloadFile, errorMessage } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { itemTitle, STATUS_META, useFlipActions } from './meta'

type Tab = 'active' | FlipStatus
type Sort = 'newest' | 'oldest' | 'listing-desc' | 'listing-asc' | 'profit-desc' | 'title'

function StatusMenu({ item }: { item: FlipItem }) {
  const actions = useFlipActions()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label={`Status: ${STATUS_META[item.status].label}. Change status`} className="rounded-md focus-visible:outline-2">
          <Badge tone={STATUS_META[item.status].tone}>{STATUS_META[item.status].label}</Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {FLIP_STATUSES.map((s) => (
          <DropdownMenuItem key={s} disabled={s === item.status} onSelect={() => actions.setStatus(item, s)}>
            <Badge tone={STATUS_META[s].tone}>{STATUS_META[s].label}</Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RowMenu({ item, onDelete }: { item: FlipItem; onDelete: () => void }) {
  const navigate = useNavigate()
  const actions = useFlipActions()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${itemTitle(item)}`}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => navigate(`/flip/items/${item.id}`)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/flip/listing?item=${item.id}`)}>
          <WandSparkles /> Write listing
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const copy = await actions.duplicate(item)
            toast.success(`Duplicated as ${copy.sku}`, { action: { label: 'Open', onClick: () => navigate(`/flip/items/${copy.id}`) } })
          }}
        >
          <Copy /> Duplicate
        </DropdownMenuItem>
        {item.status === 'archived' ? (
          <DropdownMenuItem onSelect={() => actions.unarchive(item)}>
            <ArchiveRestore /> Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.archive(item)}>
            <Archive /> Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ImportDialog({ open, onOpenChange, existing }: { open: boolean; onOpenChange: (o: boolean) => void; existing: FlipItem[] }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const log = useLogActivity()
  const [result, setResult] = React.useState<CsvImportResult | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!open) {
      setResult(null)
      setFileName('')
    }
  }, [open])

  const template = 'sku,title,brand,category,size,colour,condition,status,platform,purchase_price,listing_price,sale_price,seller_fees,shipping_cost,other_expenses,purchase_date,listed_date,sold_date,measurements,notes\n,,Nike,Hoodie,M,grey,Very good,draft,,5.00,25.00,,,,,2026-03-01,,,pit to pit 56cm,\n'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Import inventory from CSV" description="Columns are matched by name. Missing SKUs are assigned automatically." size="lg">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <span className="sr-only">Choose a CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setFileName(f.name)
                  setResult(parseItemsCsv(await f.text(), existing.map((i) => i.sku)))
                }}
              />
            </label>
            <Button variant="link" size="sm" onClick={() => downloadFile('orbit-inventory-template.csv', template, 'text/csv')}>
              Download a template
            </Button>
          </div>
          {result && (
            <div className="grid gap-3">
              <p className="text-sm">
                <span className="font-medium">{fileName}</span>: {result.rows.length} item{result.rows.length === 1 ? '' : 's'} ready to import
                {result.errors.length > 0 && `, ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} with problems`}
                {result.skipped > 0 && `, ${result.skipped} empty row${result.skipped === 1 ? '' : 's'} skipped`}.
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-36 overflow-y-auto rounded-xl border border-border p-3 text-xs text-muted-foreground scrollbar-thin">
                  {result.errors.map((e) => (
                    <li key={e.line}>
                      <span className="font-medium text-destructive">Line {e.line}:</span> {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {result.rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 text-left text-muted-foreground">
                      <tr>
                        {['SKU', 'Title', 'Brand', 'Status', 'Cost', 'Listing'].map((h) => (
                          <th key={h} className="px-2.5 py-1.5 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 8).map((r) => (
                        <tr key={r.sku} className="border-t border-border">
                          <td className="px-2.5 py-1.5 font-mono">{r.sku}</td>
                          <td className="px-2.5 py-1.5">{r.title}</td>
                          <td className="px-2.5 py-1.5">{r.brand}</td>
                          <td className="px-2.5 py-1.5">{STATUS_META[r.status ?? 'draft'].label}</td>
                          <td className="px-2.5 py-1.5 tabular">{money(r.purchase_price)}</td>
                          <td className="px-2.5 py-1.5 tabular">{money(r.listing_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rows.length > 8 && <p className="px-2.5 py-1.5 text-xs text-muted-foreground">…and {result.rows.length - 8} more</p>}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!result?.rows.length}
            loading={busy}
            onClick={async () => {
              if (!result) return
              setBusy(true)
              try {
                await backend.insertMany('flip_items', result.rows)
                invalidate(qc, backend, ['flip_items'])
                log({ module: 'flip', action: 'imported', entity_type: 'item', title: `${result.rows.length} items from ${fileName}`, link: '/flip' })
                toast.success(`Imported ${result.rows.length} items`)
                onOpenChange(false)
              } catch (e) {
                toast.error(errorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            Import {result?.rows.length || ''} items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryPage() {
  const items = useRows('flip_items')
  const { data: profile } = useProfile()
  const cur = profile?.currency ?? 'GBP'
  const actions = useFlipActions()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('status') as Tab) || 'active'
  const [query, setQuery] = React.useState('')
  const [platform, setPlatform] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [sort, setSort] = React.useState<Sort>('newest')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [importOpen, setImportOpen] = React.useState(false)
  const [toDelete, setToDelete] = React.useState<FlipItem[] | null>(null)

  const all = items.data ?? []
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { active: 0 }
    for (const s of FLIP_STATUSES) c[s] = 0
    for (const i of all) {
      c[i.status]++
      if (i.status !== 'archived' && i.status !== 'sold') c.active++
    }
    return c
  }, [all])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = all.filter((i) => (tab === 'active' ? i.status !== 'archived' && i.status !== 'sold' : i.status === tab))
    if (q) list = list.filter((i) => `${i.sku} ${i.title} ${i.brand} ${i.category} ${i.size} ${i.colour} ${i.notes}`.toLowerCase().includes(q))
    if (platform) list = list.filter((i) => i.platform === platform)
    if (category) list = list.filter((i) => i.category === category)
    const by: Record<Sort, (a: FlipItem, b: FlipItem) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      oldest: (a, b) => a.created_at.localeCompare(b.created_at),
      'listing-desc': (a, b) => (b.listing_price ?? -1) - (a.listing_price ?? -1),
      'listing-asc': (a, b) => (a.listing_price ?? Infinity) - (b.listing_price ?? Infinity),
      'profit-desc': (a, b) => (netProfit(b) ?? -Infinity) - (netProfit(a) ?? -Infinity),
      title: (a, b) => itemTitle(a).localeCompare(itemTitle(b)),
    }
    return [...list].sort(by[sort])
  }, [all, tab, query, platform, category, sort])

  React.useEffect(() => setSelected(new Set()), [tab])

  const platforms = [...new Set(all.map((i) => i.platform).filter(Boolean))].sort()
  const categories = [...new Set(all.map((i) => i.category).filter(Boolean))].sort()
  const selectedItems = filtered.filter((i) => selected.has(i.id))
  const toggle = (id: string) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setSelected(s)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: 'In stock' },
    ...FLIP_STATUSES.map((s) => ({ id: s as Tab, label: STATUS_META[s].label })),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Flip"
        title="Inventory"
        description="Everything you’re sourcing, listing and selling."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileUp /> Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!filtered.length}
              onClick={() => downloadFile(`orbit-inventory-${todayISO()}.csv`, itemsToCsv(filtered), 'text/csv;charset=utf-8')}
            >
              <Download /> Export
            </Button>
            <Button variant="accent" size="sm" asChild>
              <Link to="/flip/items/new">
                <Plus /> Add item
              </Link>
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto border-b border-border scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'active' ? {} : { status: t.id })}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground',
              tab === t.id && 'border-accent text-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU, brand, title…" className="pl-9" aria-label="Search inventory" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className="w-40">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Filter by platform" className="w-40">
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="w-44">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="listing-desc">Listing price: high to low</option>
          <option value="listing-asc">Listing price: low to high</option>
          <option value="profit-desc">Profit: highest first</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>

      {selectedItems.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm animate-in">
          <span className="font-medium">{selectedItems.length} selected</span>
          <Select
            aria-label="Set status for selected"
            className="w-44"
            value=""
            onChange={async (e) => {
              const s = e.target.value as FlipStatus
              if (!s) return
              for (const i of selectedItems) await actions.setStatus(i, s)
              toast.success(`Updated ${selectedItems.length} items`)
              setSelected(new Set())
            }}
          >
            <option value="">Set status…</option>
            {FLIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => downloadFile(`orbit-selected-${todayISO()}.csv`, itemsToCsv(selectedItems), 'text/csv')}>
            <Download /> Export
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setToDelete(selectedItems)}>
            <Trash /> Delete
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {items.isLoading ? (
        <ListSkeleton rows={6} />
      ) : items.error ? (
        <ErrorState error={items.error} onRetry={() => items.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Add your first item"
          description="Record what you paid, add photos and Orbit assigns a SKU. You can also import a spreadsheet."
          action={
            <div className="flex gap-2">
              <Button variant="accent" asChild>
                <Link to="/flip/items/new">
                  <Plus /> Add item
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp /> Import CSV
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No items match" description="Try a different search, filter or status tab." />
      ) : (
        <>
          {/* Table on wider screens */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      aria-label="Select all"
                      checked={selectedItems.length === filtered.length ? true : selectedItems.length ? 'indeterminate' : false}
                      onCheckedChange={(v) => setSelected(v ? new Set(filtered.map((i) => i.id)) : new Set())}
                    />
                  </th>
                  <th className="px-2 py-2.5 font-medium">Item</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-2 py-2.5 text-right font-medium">Listed at</th>
                  <th className="px-2 py-2.5 text-right font-medium">{tab === 'sold' ? 'Sold for' : 'Sale'}</th>
                  <th className="px-2 py-2.5 text-right font-medium">Profit</th>
                  <th className="w-20 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const profit = netProfit(i)
                  return (
                    <tr key={i.id} className={cn('border-b border-border last:border-0 hover:bg-surface-2/50', selected.has(i.id) && 'bg-surface-2/60')}>
                      <td className="px-3 py-2">
                        <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} aria-label={`Select ${itemTitle(i)}`} />
                      </td>
                      <td className="px-2 py-2">
                        <Link to={`/flip/items/${i.id}`} className="flex min-w-0 items-center gap-3">
                          <Thumb path={i.photos[0]} className="size-10 shrink-0 rounded-lg" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium hover:underline">{itemTitle(i)}</span>
                              <DemoBadge show={i.is_demo} />
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              <span className="font-mono">{i.sku}</span>
                              {[i.brand, i.size, i.platform].filter(Boolean).map((x) => ` · ${x}`)}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <StatusMenu item={i} />
                      </td>
                      <td className="px-2 py-2 text-right tabular">{money(i.purchase_price, cur)}</td>
                      <td className="px-2 py-2 text-right tabular">{money(i.listing_price, cur)}</td>
                      <td className="px-2 py-2 text-right tabular">
                        {i.sale_price !== null ? money(i.sale_price, cur) : '—'}
                        {i.sold_date && <span className="block text-[11px] text-muted-foreground">{shortDate(i.sold_date)}</span>}
                      </td>
                      <td className={cn('px-2 py-2 text-right font-medium tabular', profit !== null && (profit >= 0 ? 'text-success' : 'text-destructive'))}>
                        {profit !== null ? money(profit, cur) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end">
                          <FavouriteButton on={i.favourite} onToggle={() => actions.toggleFavourite(i)} label={itemTitle(i)} />
                          <RowMenu item={i} onDelete={() => setToDelete([i])} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards on phones */}
          <ul className="grid grid-cols-1 gap-2 md:hidden">
            {filtered.map((i) => {
              const profit = netProfit(i)
              return (
                <li key={i.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-2.5">
                  <button className="shrink-0" onClick={() => navigate(`/flip/items/${i.id}`)} aria-label={`Open ${itemTitle(i)}`}>
                    <Thumb path={i.photos[0]} className="size-14 rounded-xl" />
                  </button>
                  <Link to={`/flip/items/${i.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{itemTitle(i)}</span>
                    <span className="block truncate text-xs text-muted-foreground font-mono">{i.sku}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs tabular">
                      <Badge tone={STATUS_META[i.status].tone}>{STATUS_META[i.status].label}</Badge>
                      {profit !== null ? (
                        <span className={profit >= 0 ? 'text-success' : 'text-destructive'}>{money(profit, cur)} profit</span>
                      ) : (
                        <span className="text-muted-foreground">{money(i.listing_price, cur)}</span>
                      )}
                    </span>
                  </Link>
                  <RowMenu item={i} onDelete={() => setToDelete([i])} />
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {all.length} items
          </p>
        </>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} existing={all} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete?.length === 1 ? `Delete ${itemTitle(toDelete[0])}?` : `Delete ${toDelete?.length} items?`}
        description="This permanently removes the item, its photos and its sales record. Archive instead if you want to keep the history."
        onConfirm={async () => {
          for (const i of toDelete ?? []) await actions.destroy(i)
          toast.success(toDelete?.length === 1 ? 'Item deleted' : `${toDelete?.length} items deleted`)
          setSelected(new Set())
        }}
      />
    </div>
  )
}
