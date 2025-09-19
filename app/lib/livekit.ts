import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!
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
  const svc = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
  try {
    // Try to list rooms and check if our room exists
    const rooms = await svc.listRooms()
    const roomExists = rooms.some(room => room.name === roomName)
    
    if (!roomExists) {
      await svc.createRoom({
        name: roomName,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })
      } else if (metadata) {
        // Update metadata if the room already exists
        try {
          // updateRoom supports updating metadata
          // @ts-expect-error - SDK types may differ across versions
          await (svc as Record<string, unknown>).updateRoom({
            room: roomName,
            metadata: JSON.stringify(metadata),
          })
        } catch {
          // As a fallback, attempt to delete and recreate the room with metadata (only if empty)
          // Prefer not to disrupt active rooms; ignore on failure
        }
      }
  } catch {
    // If listing fails, try to create the room anyway
    await svc.createRoom({
      name: roomName,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    })
  }
}

export async function closeRoom(roomName: string) {
  const svc = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
  try {
    await svc.deleteRoom(roomName)
  } catch {
    // ignore not found
  }
}
