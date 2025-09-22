/**
 * Translation Service using LiveKit Agents
 * Replaces the complex Railway worker with a simple agent-based approach
 */

import { 
  Room, 
  RoomEvent, 
  RemoteParticipant, 
  ParticipantKind,
  TrackPublication,
  RemoteAudioTrack,
  ConnectionState,
  DataPacket_Kind,
  RoomOptions 
} from 'livekit-client'
import { LivekitService, type TranslationConfig } from './livekitService'

export interface TranslationSession {
  roomName: string
  sessionId?: string
  token: string
  url: string
  config: TranslationConfig
  startTime: number
}

export interface TranslationEvent {
  type: 'original' | 'translated' | 'transcription'
  text?: string
  language: string
  timestamp: number
  participant?: string
  confidence?: number
}

export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
  agentConnected: boolean
  agentState?: 'initializing' | 'listening' | 'thinking' | 'speaking'
  participantCount: number
  error?: string
}

export class TranslationService {
  private room: Room | null = null
  private session: TranslationSession | null = null
  private connectionStatus: ConnectionStatus = {
    state: 'disconnected',
    agentConnected: false,
    participantCount: 0
  }

  // Event handlers
  public onConnectionStatusChange?: (status: ConnectionStatus) => void
  public onTranslationEvent?: (event: TranslationEvent) => void
  public onError?: (error: Error) => void

  /**
   * Create a new translation session and connect to it
   */
  async createSession(config: TranslationConfig): Promise<void> {
    try {
      this.updateConnectionStatus({ state: 'connecting' })

      // Use the updated LivekitService to create translation session
      const sessionData = await LivekitService.createTranslationSession(config)
      
      this.session = {
        ...sessionData,
        startTime: Date.now()
      }
      
      // Connect to the LiveKit room
      await this.connectToRoom()

    } catch (error) {
      this.updateConnectionStatus({ 
        state: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      this.onError?.(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  /**
   * Connect to the LiveKit room with the session token
   */
  private async connectToRoom(): Promise<void> {
    if (!this.session) {
      throw new Error('No session available')
    }

    // Create room with optimized settings for translation
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000 // High quality audio for better translation
      },
      publishDefaults: {
        audioSimulcastLayers: [
          { encoding: { maxBitrate: 64000 } }, // Lower quality for bandwidth efficiency
        ]
      }
    } as RoomOptions)

    // Set up event handlers
    this.setupRoomEventHandlers()

    // Connect to the room
    await this.room.connect(this.session.url, this.session.token)

    // Enable microphone for translation input
    await this.room.localParticipant.setMicrophoneEnabled(true)

    this.updateConnectionStatus({ 
      state: 'connected',
      participantCount: this.room.numParticipants 
    })
  }

  /**
   * Set up all room event handlers
   */
  private setupRoomEventHandlers(): void {
    if (!this.room) return

    // Connection state changes
    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      const statusState = state === ConnectionState.Connected ? 'connected' :
                          state === ConnectionState.Connecting ? 'connecting' :
                          state === ConnectionState.Reconnecting ? 'reconnecting' :
                          state === ConnectionState.Disconnected ? 'disconnected' : 'failed'
      
      this.updateConnectionStatus({ state: statusState })
    })

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected)
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected)

    // Track subscription events
    this.room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed)

    // Data/text events for transcriptions and metadata
    this.room.on(RoomEvent.DataReceived, this.handleDataReceived)

    // Participant metadata updates (for agent state)
    this.room.on(RoomEvent.ParticipantMetadataChanged, this.handleParticipantMetadataChanged)

    // Error handling
    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.warn('Translation room disconnected:', reason)
      this.updateConnectionStatus({ 
        state: 'disconnected',
        error: reason ? `Disconnected: ${reason}` : 'Disconnected'
      })
    })
  }

  /**
   * Handle new participant connection (especially agents)
   */
  private handleParticipantConnected = (participant: RemoteParticipant): void => {
    console.log('Translation participant connected:', participant.identity, participant.kind)

    // Check if this is the translation agent
    if (participant.kind === ParticipantKind.Agent || 
        participant.identity.includes('agent')) {
      
      console.log('🤖 Translation agent connected!')
      this.updateConnectionStatus({ agentConnected: true })

      // Subscribe to agent's audio output (the translations)
      participant.audioTrackPublications.forEach(publication => {
        if (publication.track) {
          this.handleAgentAudio(publication.track as RemoteAudioTrack)
        }
      })
    }

    this.updateConnectionStatus({ 
      participantCount: this.room?.numParticipants || 0 
    })

    // Update session participant count
    this.updateSessionStatus({ participantCount: this.room?.numParticipants || 0 })
  }

  /**
   * Handle participant disconnection
   */
  private handleParticipantDisconnected = (participant: RemoteParticipant): void => {
    console.log('Translation participant disconnected:', participant.identity)

    if (participant.kind === ParticipantKind.Agent || 
        participant.identity.includes('agent')) {
      this.updateConnectionStatus({ agentConnected: false })
    }

    this.updateConnectionStatus({ 
      participantCount: this.room?.numParticipants || 0 
    })
  }

  /**
   * Handle track subscription
   */
  private handleTrackSubscribed = (
    track: RemoteAudioTrack, 
    publication: TrackPublication, 
    participant: RemoteParticipant
  ): void => {
    if (participant.kind === ParticipantKind.Agent && track.kind === 'audio') {
      this.handleAgentAudio(track)
    }
  }

  /**
   * Handle agent audio output (translated speech)
   */
  private handleAgentAudio(track: RemoteAudioTrack): void {
    console.log('🎧 Receiving agent translation audio')
    
    // Attach the audio track to play the translation
    const audioElement = track.attach()
    audioElement.autoplay = true
    audioElement.style.display = 'none' // Hidden audio element
    document.body.appendChild(audioElement)

    // Log translation audio event
    this.onTranslationEvent?.({
      type: 'translated',
      language: this.session?.config.targetLanguages?.[0] || 'unknown',
      timestamp: Date.now(),
      participant: 'agent'
    })
  }

  /**
   * Handle data received (text translations, transcriptions)
   */
  private handleDataReceived = (
    payload: Uint8Array, 
    participant?: RemoteParticipant,
    kind?: DataPacket_Kind
  ): void => {
    try {
      const decoder = new TextDecoder()
      const data = JSON.parse(decoder.decode(payload))

      console.log('Translation data received:', data)

      if (data.type === 'translation_text') {
        // Handle text-based translation results
        this.onTranslationEvent?.({
          type: 'translated',
          text: data.text,
          language: data.language,
          timestamp: data.timestamp || Date.now(),
          participant: participant?.identity,
          confidence: data.confidence
        })
      } else if (data.type === 'transcription') {
        // Handle original speech transcription
        this.onTranslationEvent?.({
          type: 'original',
          text: data.text,
          language: data.language,
          timestamp: data.timestamp || Date.now(),
          participant: participant?.identity,
          confidence: data.confidence
        })
      }

    } catch (error) {
      console.warn('Could not parse translation data payload:', error)
    }
  }

  /**
   * Handle participant metadata changes (agent state updates)
   */
  private handleParticipantMetadataChanged = (
    metadata: string | undefined, 
    participant: RemoteParticipant
  ): void => {
    if (participant.kind === ParticipantKind.Agent && metadata) {
      try {
        const data = JSON.parse(metadata)
        if (data.state) {
          this.updateConnectionStatus({ agentState: data.state })
        }
      } catch (error) {
        console.warn('Could not parse agent metadata:', error)
      }
    }
  }

  /**
   * Update connection status and notify listeners
   */
  private updateConnectionStatus(update: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...update }
    this.onConnectionStatusChange?.(this.connectionStatus)
  }

  /**
   * Update session status in the database
   */
  private async updateSessionStatus(update: { participantCount?: number, status?: string }): Promise<void> {
    if (!this.session?.roomName) return

    try {
      await LivekitService.updateTranslationSession({
        roomName: this.session.roomName,
        sessionId: this.session.sessionId,
        ...update
      })
    } catch (error) {
      console.warn('Could not update session status:', error)
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus }
  }

  /**
   * Disconnect from the translation session
   */
  async disconnect(): Promise<void> {
    if (!this.room || !this.session) {
      return
    }

    try {
      // Calculate session duration
      const duration = Date.now() - this.session.startTime

      // End the session in the database
      await LivekitService.endTranslationSession({
        roomName: this.session.roomName,
        sessionId: this.session.sessionId,
        duration,
        participantCount: this.room.numParticipants,
        reason: 'user_ended'
      })

      // Disconnect from room
      await this.room.disconnect()

    } catch (error) {
      console.error('Error during translation disconnect:', error)
    } finally {
      this.room = null
      this.session = null
      this.updateConnectionStatus({ 
        state: 'disconnected',
        agentConnected: false,
        participantCount: 0 
      })
    }
  }

  /**
   * Send configuration update to the agent
   */
  async updateTranslationConfig(config: Partial<TranslationConfig>): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify({
      type: 'config_update',
      ...config,
      timestamp: Date.now()
    }))

    await this.room.localParticipant.publishData(data, DataPacket_Kind.RELIABLE)
  }

  /**
   * Check if currently connected and ready for translation
   */
  isReady(): boolean {
    return this.connectionStatus.state === 'connected' && 
           this.connectionStatus.agentConnected
  }

  /**
   * Get session information
   */
  getSession(): TranslationSession | null {
    return this.session
  }

  /**
   * Get current room
   */
  getRoom(): Room | null {
    return this.room
  }
}
