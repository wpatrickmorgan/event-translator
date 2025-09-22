import { hasToken } from '@/lib/utils/type-guards'

export type AdminTokenResponse = {
  token: string
  url?: string | null
}

export type TranslationTokenResponse = {
  token: string
  roomName: string
  sessionId?: string
  url: string
  config: {
    sourceLanguage: string
    targetLanguages: string[]
    organizationId: string
  }
}

export type TranslationConfig = {
  organizationId: string
  sourceLanguage?: string
  targetLanguages?: string[]
  userName?: string
}

export const LivekitService = {
  // Existing event token method
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

  // New translation session methods
  async createTranslationSession(config: TranslationConfig): Promise<TranslationTokenResponse> {
    const res = await fetch('/api/translation/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      cache: 'no-store'
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to create translation session: ${res.statusText}`)
    }

    return await res.json()
  },

  async updateTranslationSession(update: {
    roomName?: string
    sessionId?: string
    status?: string
    participantCount?: number
    duration?: number
  }): Promise<{ success: boolean; session: any }> {
    const res = await fetch('/api/translation/update-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
      cache: 'no-store'
    })

    if (!res.ok) {
      throw new Error(`Failed to update translation session: ${res.statusText}`)
    }

    return await res.json()
  },

  async endTranslationSession(params: {
    roomName?: string
    sessionId?: string
    duration?: number
    participantCount?: number
    reason?: string
  }): Promise<{ success: boolean; session: any }> {
    const res = await fetch('/api/translation/end-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      cache: 'no-store'
    })

    if (!res.ok) {
      throw new Error(`Failed to end translation session: ${res.statusText}`)
    }

    return await res.json()
  },
}


