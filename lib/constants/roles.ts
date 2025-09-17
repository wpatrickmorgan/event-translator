export const ROLES = {
  OWNER: 'owner',
  USER: 'user'
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Helper functions for role checking
export const isOwner = (role: string | null | undefined): boolean => {
  return role === ROLES.OWNER
}

export const isUser = (role: string | null | undefined): boolean => {
  return role === ROLES.USER
}
