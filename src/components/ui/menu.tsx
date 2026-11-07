import { DropdownMenu as Menu, Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger
export const DropdownMenuGroup = Menu.Group

const menuSurface =
  'z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-surface p-1 text-sm shadow-card animate-in'

export function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content sideOffset={sideOffset} align={align} className={cn(menuSurface, className)} {...props} />
    </Menu.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-destructive [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2.5 py-1.5 text-xs text-muted-foreground', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('my-1 h-px bg-border', className)} {...props} />
}

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

export function PopoverContent({ className, sideOffset = 6, align = 'end', ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn('z-50 w-80 rounded-xl border border-border bg-surface p-3 shadow-card outline-none animate-in', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactElement; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-foreground px-2 py-1 text-xs text-background shadow animate-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
