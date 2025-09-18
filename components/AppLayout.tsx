'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AuthService } from '@/lib/services/authService'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Skeleton } from '@/components/ui/skeleton'

interface AppLayoutProps {
  children: React.ReactNode
}

const SIDEBAR_STORAGE_KEY = 'et.sidebar.collapsed'

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter()
  const { user, profile, loading } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Load sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved !== null) {
      setCollapsed(JSON.parse(saved))
    }
  }, [])

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed))
  }, [collapsed])

  // Client-side auth guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth')
    }
  }, [loading, user, router])

  // Show loading skeleton while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user) {
    return null
  }

  // Derive display name
  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : user.email || 'User'

  const handleLogout = async () => {
    await AuthService.signOut()
    router.push('/auth')
  }

  const handleEditProfile = () => {
    router.push('/profile')
  }

  const handleMenuToggle = () => {
    setMobileOpen(true)
  }

  const handleToggleCollapse = () => {
    setCollapsed(!collapsed)
  }

  const sidebarWidth = collapsed ? 64 : 256

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className="transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        {/* Header */}
        <Header
          onMenuToggle={handleMenuToggle}
          userName={userName}
          onEditProfile={handleEditProfile}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
