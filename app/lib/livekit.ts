import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const livekitAdminUrl = process.env.LIVEKIT_SERVER_URL!
const livekitApiKey = process.env.LIVEKIT_API_KEY!
const livekitApiSecret = process.env.LIVEKIT_API_SECRET!

export function mintJoinToken(params: {
  roomName: string
  identity: string
  name?: string
  metadata?: string
  canPublish?: boolean
  canSubscribe?: boolean
  canPublishData?: boolean
}) {
  const at = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: params.identity,
    name: params.name,
    metadata: params.metadata,
  })
  at.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: params.canPublish ?? true,
    canSubscribe: params.canSubscribe ?? true,
    canPublishData: params.canPublishData ?? true,
  })
  return at.toJwt()
}

export async function ensureRoom(roomName: string, metadata?: unknown) {
  const svc = new RoomServiceClient(livekitAdminUrl, livekitApiKey, livekitApiSecret)

  // Best effort create (ignore already-exists)
  try {
    await svc.createRoom({
      name: roomName,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    })
  } catch {
    // assume already exists or transient error; proceed
  }

  // Try to update metadata directly
  if (metadata) {
    try {
      await (svc as unknown as { updateRoom: (args: { room: string; metadata?: string }) => Promise<unknown> }).updateRoom({ room: roomName, metadata: JSON.stringify(metadata) })
      return
    } catch {}

    // Fallback: only if room is empty, delete and recreate with metadata
    try {
      const participants = await svc.listParticipants(roomName).catch(() => [])
      if (!participants || (Array.isArray(participants) && participants.length === 0)) {
        try { await svc.deleteRoom(roomName) } catch {}
        await svc.createRoom({ name: roomName, metadata: JSON.stringify(metadata) })
      }
    } catch {}
  }
}

export async function closeRoom(roomName: string) {
  const svc = new RoomServiceClient(livekitAdminUrl, livekitApiKey, livekitApiSecret)
  try {
    await svc.deleteRoom(roomName)
  } catch {
    // ignore not found
  }
}
