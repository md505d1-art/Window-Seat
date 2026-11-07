import { useBackend } from '@/features/auth/auth'
import { useLogActivity, useNotify, useProfile, useTable } from '@/lib/data'
import { netProfit } from '@/lib/finance'
import { money, todayISO } from '@/lib/format'
import { nextSku } from '@/lib/listing'
import type { FlipItem, FlipStatus } from '@/lib/types'

export const STATUS_META: Record<FlipStatus, { label: string; tone: 'neutral' | 'accent' | 'flip' | 'warning' | 'success' | 'outline' | 'atlas' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  ready: { label: 'Ready to list', tone: 'atlas' },
  listed: { label: 'Listed', tone: 'flip' },
  reserved: { label: 'Reserved', tone: 'warning' },
  sold: { label: 'Sold', tone: 'success' },
  archived: { label: 'Archived', tone: 'outline' },
}

export const CONDITIONS = ['New with tags', 'New without tags', 'Excellent', 'Very good', 'Good', 'Fair', 'Needs repair']
export const PLATFORMS = ['Vinted', 'eBay', 'Depop', 'Vestiaire Collective', 'Facebook Marketplace', 'Etsy', 'In person', 'Other']
export const CATEGORIES = [
  'T-shirt', 'Shirt', 'Jumper', 'Hoodie', 'Sweatshirt', 'Fleece', 'Jacket', 'Coat', 'Jeans', 'Trousers', 'Shorts', 'Dress',
  'Skirt', 'Trainers', 'Boots', 'Shoes', 'Bag', 'Hat', 'Scarf', 'Belt', 'Jewellery', 'Watch', 'Sunglasses', 'Accessory',
]

export function itemTitle(i: Pick<FlipItem, 'title' | 'brand' | 'category' | 'sku'>) {
  return i.title || [i.brand, i.category].filter(Boolean).join(' ') || i.sku
}

/** Item actions shared by the inventory list and the item page. */
export function useFlipActions() {
  const backend = useBackend()
  const { create, update, remove } = useTable('flip_items')
  const log = useLogActivity()
  const notify = useNotify()
  const { data: profile } = useProfile()
  const cur = profile?.currency ?? 'GBP'

  const statusPatch = (item: FlipItem, status: FlipStatus): Partial<FlipItem> => {
    const patch: Partial<FlipItem> = { status }
    if (status === 'archived') patch.archived_from = item.status === 'archived' ? item.archived_from : item.status
    else patch.archived_from = null
    if ((status === 'listed' || status === 'reserved') && !item.listed_date) patch.listed_date = todayISO()
    if (status === 'sold') {
      if (!item.sold_date) patch.sold_date = todayISO()
      if (item.sale_price === null && item.listing_price !== null) patch.sale_price = item.listing_price
    }
    return patch
  }

  const afterSold = (item: FlipItem) => {
    const profit = netProfit(item)
    notify({
      module: 'flip',
      title: `Sold: ${itemTitle(item)}`,
      body: `${money(item.sale_price, cur)}${profit !== null ? ` · ${money(profit, cur)} net profit` : ''}. Add fees and postage on the item to keep profit accurate.`,
      link: `/flip/items/${item.id}`,
      dedupe_key: `sold:${item.id}:${item.sold_date}`,
    })
    log({ module: 'flip', action: 'sold', entity_type: 'item', entity_id: item.id, title: itemTitle(item), link: `/flip/items/${item.id}` })
  }

  const setStatus = async (item: FlipItem, status: FlipStatus) => {
    const next = await update.mutateAsync({ id: item.id, patch: statusPatch(item, status) })
    if (status === 'sold' && item.status !== 'sold') afterSold(next)
    else log({ module: 'flip', action: `marked ${STATUS_META[status].label.toLowerCase()}`, entity_type: 'item', entity_id: item.id, title: itemTitle(item), link: `/flip/items/${item.id}` })
    return next
  }

  return {
    setStatus,
    statusPatch,
    afterSold,
    async duplicate(item: FlipItem) {
      const all = await backend.list('flip_items')
      const sku = nextSku(all.map((i) => i.sku))
      const copy = await create.mutateAsync({
        ...item,
        id: undefined,
        sku,
        title: item.title.replace(item.sku, sku),
        status: 'draft',
        archived_from: null,
        sale_price: null,
        sold_date: null,
        listed_date: null,
        photos: [], // photos belong to the original; storage paths are not shared between items
        listing: null,
        favourite: false,
        is_demo: false,
      } as Partial<FlipItem>)
      log({ module: 'flip', action: 'duplicated', entity_type: 'item', entity_id: copy.id, title: itemTitle(copy), link: `/flip/items/${copy.id}` })
      return copy
    },
    archive: (item: FlipItem) => setStatus(item, 'archived'),
    async unarchive(item: FlipItem) {
      return update.mutateAsync({ id: item.id, patch: { status: item.archived_from ?? 'draft', archived_from: null } })
    },
    async destroy(item: FlipItem) {
      await remove.mutateAsync(item.id)
      if (item.photos.length) backend.removeFiles(item.photos).catch(() => undefined)
      log({ module: 'flip', action: 'deleted', entity_type: 'item', entity_id: null, title: itemTitle(item) })
    },
    toggleFavourite(item: FlipItem) {
      update.mutate({ id: item.id, patch: { favourite: !item.favourite } })
    },
  }
}
