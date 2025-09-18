'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventService } from '@/lib/services/eventService'
import { Loader2, ArrowLeft, Calendar, Users, Globe, Shield } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { EventStatus } from '@/lib/types/event'

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  // Fetch event details
  const {
    data: event,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const result = await EventService.getEventById(eventId)
      if (result.error) throw new Error(result.error)
      return result.data
    },
    enabled: !!eventId,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading event...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {error instanceof Error ? error.message : 'Event not found'}
          </p>
          <Button onClick={() => router.push('/events')}>
            Back to Events
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/events')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Event ID: {event.id}
          </p>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Event Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-lg">{event.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Start Time</label>
                <p className="text-lg">{format(new Date(event.start_time), 'PPP p')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Event Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">Public Event</label>
                  <p className="text-sm text-gray-600">Allow others to join with a code</p>
                </div>
                <div className="flex items-center">
                  {event.is_public ? (
                    <Globe className="h-5 w-5 text-green-600" />
                  ) : (
                    <Shield className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
              
              {event.is_public && event.join_code && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Join Code</label>
                  <p className="text-lg font-mono font-bold text-blue-600">{event.join_code}</p>
                  <p className="text-xs text-gray-500 mt-1">Note: Join code is case sensitive.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">Record Transcript</label>
                  <p className="text-sm text-gray-600">Save event transcript for later review</p>
                </div>
                <div className="flex items-center">
                  {event.record_transcript ? (
                    <div className="h-2 w-2 bg-green-600 rounded-full" />
                  ) : (
                    <div className="h-2 w-2 bg-gray-400 rounded-full" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Management Controls */}
        <Card className="mt-6">
          <CardContent>
            <EventControls eventId={event.id} currentStatus={event.status} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EventControls({ eventId, currentStatus }: { eventId: string; currentStatus: EventStatus }) {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (next: EventStatus) => {
      const { error } = await EventService.updateEventStatus(eventId, next)
      if (error) throw new Error(error)
    },
    onSuccess: () => {
      // Refresh this event and mark events list stale so it refetches when visiting `/events`
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Status updated')
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    },
  })

  const canStart = currentStatus === 'scheduled' || currentStatus === 'paused'
  const canPause = currentStatus === 'live'
  const canEnd = currentStatus === 'scheduled' || currentStatus === 'live' || currentStatus === 'paused'
  const isEnded = currentStatus === 'ended'

  const getStatusInfo = (status: EventStatus) => {
    switch (status) {
      case 'scheduled':
        return { label: 'waiting', color: 'bg-gray-500', textColor: 'text-gray-700' }
      case 'live':
        return { label: 'live', color: 'bg-green-500', textColor: 'text-green-700' }
      case 'paused':
        return { label: 'paused', color: 'bg-yellow-500', textColor: 'text-yellow-700' }
      case 'ended':
        return { label: 'ended', color: 'bg-red-500', textColor: 'text-red-700' }
      case 'canceled':
        return { label: 'ended', color: 'bg-gray-500', textColor: 'text-gray-700' }
      default:
        return { label: 'waiting', color: 'bg-gray-500', textColor: 'text-gray-700' }
    }
  }

  const statusInfo = getStatusInfo(currentStatus)

  return (
    <div className="flex items-center justify-between">
      {/* Control Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={() => mutateAsync('live')} 
          disabled={!canStart || isPending || isEnded}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Start
        </Button>
        <Button 
          variant="secondary" 
          onClick={() => mutateAsync('paused')} 
          disabled={!canPause || isPending || isEnded}
          className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300"
        >
          Pause
        </Button>
        <Button 
          variant="destructive" 
          onClick={() => mutateAsync('ended')} 
          disabled={!canEnd || isPending || isEnded}
        >
          End
        </Button>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${statusInfo.color}`} />
        <span className={`text-sm font-medium ${statusInfo.textColor}`}>
          {statusInfo.label}
        </span>
      </div>
    </div>
  )
}
