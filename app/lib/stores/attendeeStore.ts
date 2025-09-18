import { create } from 'zustand'
import type { PublicEventData } from '@/lib/services/publicEventService'
import type { AttendeeTokenResponse } from '@/lib/services/attendeeTokenService'

interface AttendeeStore {
  // Event data
  eventData: PublicEventData | null
  
  // Language selection
  selectedLanguageId: string | null
  
  // Stream toggles
  enableAudio: boolean
  enableCaptions: boolean
  
  // Join state
  joining: boolean
  
  // Token and room info
  token: string | null
  roomName: string | null
  expiresAt: string | null
  
  // State setters
  setEventData: (data: PublicEventData | null) => void
  setSelectedLanguageId: (languageId: string | null) => void
  setStreams: (audio: boolean, captions: boolean) => void
  setJoining: (joining: boolean) => void
  setJoinAuth: (auth: AttendeeTokenResponse) => void
  reset: () => void
}

export const useAttendeeStore = create<AttendeeStore>((set) => ({
  // Initial state
  eventData: null,
  selectedLanguageId: null,
  enableAudio: false,
  enableCaptions: true,
  joining: false,
  token: null,
  roomName: null,
  expiresAt: null,

  // State setters
  setEventData: (data) => set({ eventData: data }),
  
  setSelectedLanguageId: (languageId) => {
    set({ selectedLanguageId: languageId })
    
    // Auto-update stream toggles based on selected language capabilities
    const state = useAttendeeStore.getState()
    if (state.eventData && languageId) {
      const language = state.eventData.languages.find(l => l.id === languageId)
      if (language) {
        set({
          enableAudio: language.has_audio,
          enableCaptions: language.has_captions,
        })
      }
    }
  },
  
  setStreams: (audio, captions) => set({ enableAudio: audio, enableCaptions: captions }),
  
  setJoining: (joining) => set({ joining }),
  
  setJoinAuth: (auth) => set({
    token: auth.token,
    roomName: auth.roomName,
    expiresAt: auth.expiresAt,
  }),
  
  reset: () => set({
    eventData: null,
    selectedLanguageId: null,
    enableAudio: false,
    enableCaptions: true,
    joining: false,
    token: null,
    roomName: null,
    expiresAt: null,
  }),
}))
