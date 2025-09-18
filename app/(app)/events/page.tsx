"use client"

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { EventsTable } from '@/components/events/events-table'
import { CreateEventDialog } from '@/components/events/create-event-dialog'
import { useAuthStore } from '@/lib/stores/authStore'
import { UserService } from '@/lib/services/userService'
import { EventService } from '@/lib/services/eventService'
import { Loader2, Plus } from 'lucide-react'

export default function EventsPage() {
  const userOrganizations = useAuthStore(state => state.userOrganizations)

  // Get organization ID
  const orgId = UserService.getUserOrganization(userOrganizations)

  // Fetch events
  const {
    data: events = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['events', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('No organization found')
      const result = await EventService.listEventsForOrg(orgId)
      if (result.error) throw new Error(result.error)
      return result.data
    },
    enabled: !!orgId,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading events...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {error instanceof Error ? error.message : 'Failed to load events'}
          </p>
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardAction>
              <CreateEventDialog>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </CreateEventDialog>
            </CardAction>
          </CardHeader>
          <CardContent>
            <EventsTable events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
