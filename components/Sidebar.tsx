'use client'

import { ChevronLeft, ChevronRight, Home, Calendar, Settings } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface SidebarLink {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  links?: SidebarLink[]
}

const defaultLinks: SidebarLink[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: Home,
  },
  {
    href: '/events',
    label: 'Events',
    icon: Calendar,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
  },
]

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileOpenChange,
  links = defaultLinks,
}: SidebarProps) {
  const pathname = usePathname()

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href + '/') || pathname === href
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Navigation Links */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = isActiveLink(link.href)
            
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => mobileOpen && onMobileOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? link.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Collapse Toggle Button */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] border-r bg-background transition-[width] duration-300 ease-in-out',
          'md:block',
          collapsed ? 'w-16' : 'w-64'
        )}
        style={{ width: 'var(--sidebar-width)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 p-0" id="mobile-sidebar">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
