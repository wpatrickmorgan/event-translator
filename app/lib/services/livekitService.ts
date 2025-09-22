import { hasToken } from '@/lib/utils/type-guards'

export type AdminTokenResponse = {
  token: string
  url?: string | null
}

export const LivekitService = {
  /**
   * Fetch admin token for event room access
   */
  async fetchAdminToken(eventId: string, identity: string, name: string): Promise<AdminTokenResponse> {
    const qs = new URLSearchParams({ eventId, identity, name })
    const res = await fetch(`/api/livekit-token?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error('Failed to fetch LiveKit token')
    }
    const json = await res.json()
    if (!hasToken(json)) {
      throw new Error('Invalid response: missing token')
    }
    return { 
      token: json.token, 
      url: ('url' in json && typeof json.url === 'string') ? json.url : null 
    }
  },
}


