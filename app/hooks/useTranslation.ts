/**
 * useTranslation Hook
 * Simplified hook that integrates with existing app architecture
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { TranslationService } from '@/lib/services/translationService'
import type { TranslationConfig } from '@/lib/services/livekitService'
import type { ConnectionStatus, TranslationEvent } from '@/lib/services/translationService'

export interface UseTranslationOptions {
  onTranslationReceived?: (event: TranslationEvent) => void
  onError?: (error: Error) => void
  onConnectionChange?: (status: ConnectionStatus) => void
  autoConnect?: boolean
}

export interface UseTranslationReturn {
  // Connection state
  isConnecting: boolean
  isConnected: boolean
  isReady: boolean
  connectionStatus: ConnectionStatus
  error: string | null

  // Translation events
  translationEvents: TranslationEvent[]
  
  // Actions
  startTranslation: (config: TranslationConfig) => Promise<void>
  stopTranslation: () => Promise<void>
  updateConfig: (config: Partial<TranslationConfig>) => Promise<void>
  clearEvents: () => void

  // Service instance (for advanced usage)
  service: TranslationService | null
}

export function useTranslation(options: UseTranslationOptions = {}): UseTranslationReturn {
  // Service instance
  const serviceRef = useRef<TranslationService | null>(null)

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    agentConnected: false,
    participantCount: 0
  })
  const [translationEvents, setTranslationEvents] = useState<TranslationEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  // Initialize service if not exists
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new TranslationService()
      
      // Set up event handlers
      serviceRef.current.onConnectionStatusChange = (status) => {
        setConnectionStatus(status)
        setError(status.error || null)
        options.onConnectionChange?.(status)
      }

      serviceRef.current.onTranslationEvent = (event) => {
        setTranslationEvents(prev => {
          // Limit stored events to prevent memory issues
          const newEvents = [...prev, event]
          return newEvents.slice(-100) // Keep last 100 events
        })
        options.onTranslationReceived?.(event)
      }

      serviceRef.current.onError = (error) => {
        setError(error.message)
        options.onError?.(error)
      }
    }
    return serviceRef.current
  }, [options])

  // Start translation session
  const startTranslation = useCallback(async (config: TranslationConfig) => {
    try {
      setError(null)
      const service = getService()
      await service.createSession(config)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      options.onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [getService, options])

  // Stop translation session
  const stopTranslation = useCallback(async () => {
    try {
      if (serviceRef.current) {
        await serviceRef.current.disconnect()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      options.onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [options])

  // Update translation configuration
  const updateConfig = useCallback(async (config: Partial<TranslationConfig>) => {
    try {
      if (serviceRef.current && serviceRef.current.isReady()) {
        await serviceRef.current.updateTranslationConfig(config)
      } else {
        throw new Error('Translation service not ready')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      options.onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [options])

  // Clear translation events
  const clearEvents = useCallback(() => {
    setTranslationEvents([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect().catch(console.error)
      }
    }
  }, [])

  // Computed values
  const isConnecting = connectionStatus.state === 'connecting'
  const isConnected = connectionStatus.state === 'connected'
  const isReady = isConnected && connectionStatus.agentConnected

  return {
    // Connection state
    isConnecting,
    isConnected,
    isReady,
    connectionStatus,
    error,

    // Translation events
    translationEvents,
    
    // Actions
    startTranslation,
    stopTranslation,
    updateConfig,
    clearEvents,

    // Service instance
    service: serviceRef.current
  }
}

// Utility hook for simple translation sessions
export function useSimpleTranslation(
  organizationId: string,
  options?: {
    sourceLanguage?: string
    targetLanguages?: string[]
    userName?: string
    onTranslationReceived?: (event: TranslationEvent) => void
    onError?: (error: Error) => void
  }
) {
  const translationHook = useTranslation(options)

  const startSimpleTranslation = useCallback(() => {
    return translationHook.startTranslation({
      organizationId,
      sourceLanguage: options?.sourceLanguage || 'auto-detect',
      targetLanguages: options?.targetLanguages || ['spanish'],
      userName: options?.userName
    })
  }, [organizationId, options, translationHook])

  return {
    ...translationHook,
    startTranslation: startSimpleTranslation
  }
}
