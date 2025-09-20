export type AdminTokenResponse = {
  token: string
  url?: string | null
}

export const LivekitService = {
  async fetchAdminToken(eventId: string, identity: string, name: string): Promise<AdminTokenResponse> {
    const qs = new URLSearchParams({ eventId, identity, name })
    const res = await fetch(`/api/livekit-token?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error('Failed to fetch LiveKit token')
    }
    const json = (await res.json()) as { token: string; url?: string | null }
    return { token: json.token, url: json.url ?? null }
  },
}


