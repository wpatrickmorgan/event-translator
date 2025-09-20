// Type guard utilities for safe type checking
// Following the repo guidelines for avoiding 'any' types

export function hasErrorMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
}

export function hasErrorCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
}

export function hasToken(obj: unknown): obj is { token: string } {
  return typeof obj === 'object' && obj !== null && 'token' in obj && typeof obj.token === 'string'
}

export function hasVoiceId(obj: unknown): obj is { voice_id: string } {
  return typeof obj === 'object' && obj !== null && 'voice_id' in obj && typeof obj.voice_id === 'string'
}

export function hasIdentities(user: unknown): user is { identities: unknown[] } {
  return typeof user === 'object' && user !== null && 'identities' in user && Array.isArray(user.identities)
}

export function isPublicBoolean(obj: unknown): obj is { is_public: boolean } {
  return typeof obj === 'object' && obj !== null && 'is_public' in obj && typeof obj.is_public === 'boolean'
}

export function isValidEventRow(row: unknown): row is {
  event_id: string
  room_name: string
} {
  return typeof row === 'object' && row !== null &&
    'event_id' in row && typeof row.event_id === 'string' &&
    'room_name' in row && typeof row.room_name === 'string'
}

export function hasIsPublic(obj: unknown): obj is { is_public: boolean } {
  return typeof obj === 'object' && obj !== null && 'is_public' in obj && typeof obj.is_public === 'boolean'
}

export function hasLanguageCode(obj: unknown): obj is { language: { code: string } } {
  return typeof obj === 'object' && obj !== null && 
    'language' in obj && 
    typeof obj.language === 'object' && obj.language !== null &&
    'code' in obj.language && typeof obj.language.code === 'string'
}
