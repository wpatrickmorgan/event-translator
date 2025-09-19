export interface AttendeeTokenRequest {
  code: string
  languageId: string
  enableAudio: boolean
  enableCaptions: boolean
  name?: string
}

export interface AttendeeTokenResponse {
  token: string
  roomName: string
  expiresAt: string
}

export class AttendeeTokenService {
  /**
   * Request an attendee token for joining a public event
   */
  static async requestToken(request: AttendeeTokenRequest): Promise<AttendeeTokenResponse> {
    try {
      const response = await fetch('/api/attendee-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to get attendee token'
        
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch {
          // Use default error message if parsing fails
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error requesting attendee token:', error)
      throw error
    }
  }
}
