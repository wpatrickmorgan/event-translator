import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const livekitAdminUrl = process.env.LIVEKIT_SERVER_URL!
const livekitApiKey = process.env.LIVEKIT_API_KEY!
const livekitApiSecret = process.env.LIVEKIT_API_SECRET!

export async function mintJoinToken(params: {
  roomName: string
  identity: string
  name?: string
  metadata?: string
  canPublish?: boolean
  canSubscribe?: boolean
  canPublishData?: boolean
}): Promise<string> {
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
  return await at.toJwt()
}

export async function ensureRoom(roomName: string) {
  const svc = new RoomServiceClient(livekitAdminUrl, livekitApiKey, livekitApiSecret)

  // Try to create the room
  try {
    console.log(`[LiveKit] Creating room ${roomName}`)
    const room = await svc.createRoom({ name: roomName })
    console.log(`[LiveKit] Room created successfully`)
    return room
  } catch (error) {
    // Check if room already exists
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: number })?.code
    
    if (errorMessage?.includes('already exists') || errorCode === 6) {
      console.log(`[LiveKit] Room ${roomName} already exists`)
      // That's fine, room is ready
      return
    } else {
      // Some other error occurred
      console.error(`[LiveKit] Failed to create room:`, errorMessage)
      throw new Error(`Failed to create room: ${errorMessage}`)
    }
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
