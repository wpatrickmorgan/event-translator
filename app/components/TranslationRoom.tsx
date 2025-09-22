'use client'

/**
 * Translation Room Component
 * A simple component for starting and managing translation sessions using LiveKit Agents
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation, type UseTranslationOptions } from '@/hooks/useTranslation'
import type { TranslationEvent } from '@/lib/services/translationService'

interface TranslationRoomProps {
  organizationId: string
  className?: string
  sourceLanguage?: string
  targetLanguages?: string[]
  userName?: string
  onTranslationReceived?: (event: TranslationEvent) => void
}

export function TranslationRoom({
  organizationId,
  className,
  sourceLanguage = 'auto-detect',
  targetLanguages = ['spanish'],
  userName = 'User',
  onTranslationReceived
}: TranslationRoomProps) {
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [displayEvents, setDisplayEvents] = useState<TranslationEvent[]>([])

  const translationOptions: UseTranslationOptions = {
    onTranslationReceived: useCallback((event: TranslationEvent) => {
      setDisplayEvents(prev => [...prev.slice(-19), event]) // Keep last 20 events
      onTranslationReceived?.(event)
    }, [onTranslationReceived]),
    onError: useCallback((error: Error) => {
      console.error('Translation error:', error)
    }, [])
  }

  const {
    isConnecting,
    isConnected,
    isReady,
    connectionStatus,
    error,
    startTranslation,
    stopTranslation,
    clearEvents
  } = useTranslation(translationOptions)

  const handleStartTranslation = async () => {
    try {
      setSessionStartTime(Date.now())
      setDisplayEvents([])
      clearEvents()
      
      await startTranslation({
        organizationId,
        sourceLanguage,
        targetLanguages,
        userName
      })
    } catch (error) {
      console.error('Failed to start translation:', error)
    }
  }

  const handleStopTranslation = async () => {
    try {
      await stopTranslation()
      setSessionStartTime(null)
    } catch (error) {
      console.error('Failed to stop translation:', error)
    }
  }

  // Calculate session duration
  const sessionDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Status indicator
  const getStatusColor = () => {
    if (error) return 'text-red-600'
    if (isReady) return 'text-green-600'
    if (isConnected) return 'text-yellow-600'
    if (isConnecting) return 'text-blue-600'
    return 'text-gray-500'
  }

  const getStatusText = () => {
    if (error) return `Error: ${error}`
    if (isReady) return 'Ready for translation'
    if (connectionStatus.agentConnected) return 'Agent connected, starting...'
    if (isConnected) return 'Connected, waiting for agent...'
    if (isConnecting) return 'Connecting...'
    return 'Disconnected'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Real-Time Translation</CardTitle>
        <CardDescription>
          Translating from {sourceLanguage} to {targetLanguages.join(', ')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : isConnecting ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          {sessionStartTime && (
            <div className="text-sm text-gray-600">
              {formatDuration(sessionDuration)}
            </div>
          )}
        </div>

        {/* Connection Info */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Participants:</span> {connectionStatus.participantCount}
            </div>
            <div>
              <span className="font-medium">Agent State:</span> {connectionStatus.agentState || 'Unknown'}
            </div>
          </div>
        )}

        {/* Translation Events Display */}
        {displayEvents.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700">Recent Translations:</h4>
            {displayEvents.map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className={`text-sm p-2 rounded ${
                  event.type === 'original' 
                    ? 'bg-blue-100 border-l-4 border-blue-400' 
                    : 'bg-green-100 border-l-4 border-green-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">
                    {event.type === 'original' ? 'Original' : 'Translation'} ({event.language})
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.text && (
                  <div className="text-gray-700">{event.text}</div>
                )}
                {event.confidence && (
                  <div className="text-xs text-gray-500 mt-1">
                    Confidence: {Math.round(event.confidence * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        {isReady && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Ready!</strong> Start speaking and your speech will be translated to {targetLanguages.join(' and ')}.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          onClick={handleStartTranslation}
          disabled={isConnecting || isConnected}
          className="flex-1 mr-2"
        >
          {isConnecting ? 'Starting...' : 'Start Translation'}
        </Button>
        
        <Button
          variant="outline"
          onClick={handleStopTranslation}
          disabled={!isConnected}
          className="flex-1 ml-2"
        >
          Stop Translation
        </Button>
      </CardFooter>
    </Card>
  )
}

// Example usage component for testing
export function TranslationRoomExample() {
  const [selectedLanguage, setSelectedLanguage] = useState('spanish')
  const [lastTranslation, setLastTranslation] = useState<TranslationEvent | null>(null)

  const handleTranslationReceived = (event: TranslationEvent) => {
    if (event.type === 'translated' && event.text) {
      setLastTranslation(event)
    }
  }

  return (
    <div className="space-y-6">
      <TranslationRoom
        organizationId="your-org-id" // Replace with actual org ID
        sourceLanguage="auto-detect"
        targetLanguages={[selectedLanguage]}
        userName="Test User"
        onTranslationReceived={handleTranslationReceived}
        className="max-w-2xl mx-auto"
      />

      {/* Language Selector */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Translation Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Language:</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="italian">Italian</option>
                <option value="portuguese">Portuguese</option>
                <option value="chinese">Chinese</option>
                <option value="japanese">Japanese</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Translation Display */}
      {lastTranslation && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">Latest Translation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">
                Translated to {lastTranslation.language} at{' '}
                {new Date(lastTranslation.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-lg font-medium text-gray-800">
                {lastTranslation.text}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
