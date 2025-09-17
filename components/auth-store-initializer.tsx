'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'

export function AuthStoreInitializer() {
  const initialize = useAuthStore(state => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return null
}
