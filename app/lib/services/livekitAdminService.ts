import { Room, RoomEvent, LocalAudioTrack, createLocalAudioTrack } from 'livekit-client'

export type InputChannel = {
  room: Room
  track: LocalAudioTrack | null
}

export const LivekitAdminService = {
  async connect(url: string | null | undefined, token: unknown, onDisconnected?: () => void): Promise<Room> {
    if (!url) throw new Error('LiveKit URL is not configured')
    const tokenStr = typeof token === 'string'
      ? token
      : (token && typeof token === 'object' && 'token' in (token as any))
      ? String((token as any).token)
      : (() => { throw new Error('Invalid LiveKit token') })()
    const room = new Room()
    await room.connect(url, tokenStr, { autoSubscribe: true })
    if (onDisconnected) {
      room.on(RoomEvent.Disconnected, () => {
        try { onDisconnected() } catch {}
      })
    }
    return room
  },

  async publishMic(room: Room): Promise<LocalAudioTrack> {
    const track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })
    await room.localParticipant.publishTrack(track)
    try { await track.unmute() } catch {}
    return track
  },

  async mute(track: LocalAudioTrack) {
    try { await track.mute() } catch {}
  },

  async unmute(track: LocalAudioTrack) {
    try { await track.unmute() } catch {}
  },

  async unpublishAndStop(room: Room, track: LocalAudioTrack) {
    try { await track.mute() } catch {}
    try { room.localParticipant.unpublishTrack(track, true) } catch {}
  },

  async disconnect(room: Room) {
    try { room.disconnect() } catch {}
  },
}


