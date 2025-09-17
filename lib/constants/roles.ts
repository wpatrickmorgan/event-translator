export const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Helper functions for role checking
export const isAdmin = (role: string | null | undefined): boolean => {
  return role === ROLES.ADMIN
}

export const isUser = (role: string | null | undefined): boolean => {
  return role === ROLES.USER
}
