'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PublicEventService } from '@/lib/services/publicEventService'
import { AttendeeTokenService } from '@/lib/services/attendeeTokenService'
import { useAttendeeStore } from '@/lib/stores/attendeeStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function JoinPage() {
  const router = useRouter()
  const params = useSearchParams()
  const code = params.get('code')?.trim() || ''
  const prefLang = params.get('lang') || undefined
  const name = params.get('name') || undefined

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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const preferredLanguageId = useMemo(() => {
    if (!eventData) return null
    if (prefLang) {
      const lang = eventData.languages.find(l => l.code === prefLang)
      if (lang) return lang.id
    }
    // default to first available language
    return eventData.languages[0]?.id ?? null
  }, [eventData, prefLang])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!code) {
        setError('Missing join code')
        setLoading(false)
        return
      }
      try {
        const data = await PublicEventService.getEventByCode(code)
        if (cancelled) return
        if (!data || !data.event || data.event.is_public === false) {
          setError('Event not available')
          setLoading(false)
          return
        }
        setEventData(data)
        setLoading(false)
      } catch (e) {
        setError('Failed to load event')
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [code, setEventData])

  useEffect(() => {
    if (!eventData) return
    if (!selectedLanguageId && preferredLanguageId) {
      setSelectedLanguageId(preferredLanguageId)
    }
  }, [eventData, preferredLanguageId, selectedLanguageId, setSelectedLanguageId])

  async function handleJoin() {
    if (!code || !selectedLanguageId) return
    try {
      setJoining(true)
      const auth = await AttendeeTokenService.requestToken({
        code,
        languageId: selectedLanguageId,
        enableAudio,
        enableCaptions,
        name,
      })
      setJoinAuth(auth)
      router.push(`/watch?room=${encodeURIComponent(auth.roomName)}&token=${encodeURIComponent(auth.token)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  // Auto-join when we have event data and language selection
  useEffect(() => {
    if (!loading && !error && eventData && selectedLanguageId && !joining) {
      handleJoin()
    }
  }, [loading, error, eventData, selectedLanguageId, joining])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>Unable to Join</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>{eventData?.event.name}</CardTitle>
          <CardDescription>Joining...</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Requesting token
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


