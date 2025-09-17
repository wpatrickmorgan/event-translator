import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { User, Profile, UserOrganization, UserState } from '@/lib/types/auth'
import { AuthService } from '@/lib/services/authService'
import { UserService } from '@/lib/services/userService'

interface AuthStore {
  // State only
  user: User | null
  profile: Profile | null
  userOrganizations: UserOrganization[]
  loading: boolean
  initialized: boolean

  // Computed values
  userState: UserState
  hasOrganization: boolean

  // State actions only
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setUserOrganizations: (userOrganizations: UserOrganization[]) => void
  setLoading: (loading: boolean) => void
  setUserData: (data: { profile: Profile | null; userOrganizations: UserOrganization[] }) => void

  // Initialization
  initialize: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  profile: null,
  userOrganizations: [],
  loading: true,
  initialized: false,

  // Computed values
  get userState(): UserState {
    const { user, userOrganizations } = get()
    if (!user) return 'not_signed_up'
    if (!user.email_confirmed_at) return 'unconfirmed'
    if (userOrganizations.length === 0) return 'confirmed_no_organization'
    return 'confirmed_with_organization'
  },

  get hasOrganization(): boolean {
    return get().userOrganizations.length > 0
  },

  // State setters
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setUserOrganizations: (userOrganizations) => set({ userOrganizations }),
  setLoading: (loading) => set({ loading }),
  setUserData: (data) => set({ 
    profile: data.profile, 
    userOrganizations: data.userOrganizations 
  }),

  // Initialize store - called once on app start
  initialize: async () => {
    const { initialized } = get()
    if (initialized) return

    set({ initialized: true })

    // Get initial session
    const { data: { session } } = await AuthService.getSession()
    const user = session?.user ?? null
    set({ user })

    if (user) {
      // Create profile if user is confirmed and doesn't have one
      if (user.email_confirmed_at) {
        await AuthService.createProfileFromSession(user)
      }
      
      const userData = await UserService.fetchUserData(user.id)
      get().setUserData(userData)
    }
    set({ loading: false })

    // Listen for auth changes - single listener for entire app
    AuthService.onAuthStateChange(async (event, session) => {
      const user = (session as Session | null)?.user ?? null
      set({ user })
      
      if (user) {
        set({ loading: true })
        try {
          // Create profile if user is confirmed and doesn't have one
          if (user.email_confirmed_at) {
            await AuthService.createProfileFromSession(user)
          }
          
          // Fetch user data
          const userData = await UserService.fetchUserData(user.id)
          get().setUserData(userData)
        } finally {
          set({ loading: false }) // always clear
        }
      } else {
        set({ 
          profile: null, 
          userOrganizations: [], 
          loading: false 
        })
      }
    })
  },
}))
