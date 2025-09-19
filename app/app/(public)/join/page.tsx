'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PublicEventService } from '@/lib/services/publicEventService'
import { AttendeeTokenService } from '@/lib/services/attendeeTokenService'
import { useAttendeeStore } from '@/lib/stores/attendeeStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

function JoinPageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const code = params.get('code')?.trim() || ''
  const prefLang = params.get('lang') || undefined
  const name = params.get('name') || undefined
  const room = params.get('room')
  const token = params.get('token')

  const {
    eventData,
    selectedLanguageId,
    enableAudio,
    enableCaptions,
    joining,
    setEventData,
    setSelectedLanguageId,
    setStreams,
    setJoining,
    setJoinAuth,
  } = useAttendeeStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [nameInput, setNameInput] = useState(name || '')
  const [showJoinForm, setShowJoinForm] = useState(false)

  const preferredLanguageId = useMemo(() => {
    if (!eventData) return null
    if (prefLang) {
      const lang = eventData.languages.find(l => l.code === prefLang)
      if (lang) return lang.id
    }
    // default to first available language
    return eventData.languages[0]?.id ?? null
  }, [eventData, prefLang])

  // Handle direct navigation with token (from successful join)
  useEffect(() => {
    if (room && token && code) {
      // User has already joined and been redirected here with token
      // This would typically trigger the live view, but since we don't have a live component yet,
      // we'll show a success message
      setShowJoinForm(false)
    }
  }, [room, token, code])

  // Load event data when code is provided
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!code) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)
        const data = await PublicEventService.getEventByCode(code)
        if (cancelled) return
        if (!data || !data.event || data.event.is_public === false) {
          setError('Event not available')
          setLoading(false)
          return
        }
        setEventData(data)
        setShowJoinForm(true)
        setLoading(false)
    } catch {
      setError('Failed to load event')
      setLoading(false)
    }
    }
    load()
    return () => { cancelled = true }
  }, [code, setEventData])

  // Set preferred language when event data loads
  useEffect(() => {
    if (!eventData) return
    if (!selectedLanguageId && preferredLanguageId) {
      setSelectedLanguageId(preferredLanguageId)
    }
  }, [eventData, preferredLanguageId, selectedLanguageId, setSelectedLanguageId])

  async function handleCodeSubmit() {
    if (!codeInput.trim()) {
      setError('Please enter a join code')
      return
    }
    router.push(`/join?code=${encodeURIComponent(codeInput.trim())}&name=${encodeURIComponent(nameInput.trim())}`)
  }

  async function handleJoin() {
    if (!code || !selectedLanguageId) return
    try {
      setJoining(true)
      setError(null)
      const auth = await AttendeeTokenService.requestToken({
        code,
        languageId: selectedLanguageId,
        enableAudio,
        enableCaptions,
        name: nameInput.trim() || undefined,
      })
      setJoinAuth(auth)
      router.push(`/join?code=${encodeURIComponent(code)}&room=${encodeURIComponent(auth.roomName)}&token=${encodeURIComponent(auth.token)}#live`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  // Show code entry form when no code is provided
  if (!code) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>Join Event</CardTitle>
            <CardDescription>Enter the join code provided by the event organizer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Join Code
              </label>
              <Input
                id="code"
                type="text"
                placeholder="Enter join code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Your Name (Optional)
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            <Button onClick={handleCodeSubmit} className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Show error state
  if (error && !showJoinForm) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>Unable to Join</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/join')}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show success state (when user has joined and been redirected)
  if (room && token) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>Successfully Joined!</CardTitle>
            <CardDescription>You are now connected to the event</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded mb-4">
              Room: {room}
            </div>
            <Button onClick={() => router.push('/join')} variant="outline" className="w-full">
              Join Another Event
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show join form with language selection and toggles
  if (showJoinForm && eventData) {
    const selectedLanguage = eventData.languages.find(l => l.id === selectedLanguageId)
    
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>{eventData.event.name}</CardTitle>
            <CardDescription>Configure your preferences before joining</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label htmlFor="join-name" className="text-sm font-medium">
                Your Name (Optional)
              </label>
              <Input
                id="join-name"
                type="text"
                placeholder="Enter your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <div className="space-y-2">
                {eventData.languages.map((language) => (
                  <div key={language.id} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`lang-${language.id}`}
                      name="language"
                      value={language.id}
                      checked={selectedLanguageId === language.id}
                      onChange={(e) => setSelectedLanguageId(e.target.value)}
                      className="h-4 w-4"
                    />
                    <label htmlFor={`lang-${language.id}`} className="text-sm">
                      {language.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Stream Toggles */}
            {selectedLanguage && (
              <div className="space-y-4">
                <div className="text-sm font-medium">Stream Options</div>
                
                {selectedLanguage.has_audio && (
                  <div className="flex items-center justify-between">
                    <label htmlFor="audio-toggle" className="text-sm">
                      Enable Audio
                    </label>
                    <Switch
                      id="audio-toggle"
                      checked={enableAudio}
                      onCheckedChange={(checked) => setStreams(checked, enableCaptions)}
                    />
                  </div>
                )}
                
                {selectedLanguage.has_captions && (
                  <div className="flex items-center justify-between">
                    <label htmlFor="captions-toggle" className="text-sm">
                      Enable Captions
                    </label>
                    <Switch
                      id="captions-toggle"
                      checked={enableCaptions}
                      onCheckedChange={(checked) => setStreams(enableAudio, checked)}
                    />
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <Button 
              onClick={handleJoin} 
              className="w-full" 
              disabled={joining || !selectedLanguageId}
            >
              {joining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Event'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  )
}