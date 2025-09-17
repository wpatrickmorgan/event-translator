import { supabase } from '@/lib/supabase'
import type { SignUpData, AuthResponse, ProfileInsert } from '@/lib/types/auth'

export class AuthService {
  /**
   * Sign up a new user (profile created after email confirmation)
   */
  static async signUp(signUpData: SignUpData): Promise<AuthResponse> {
    try {
      // Create auth user - profile will be created after email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          data: {
            first_name: signUpData.first_name,
            last_name: signUpData.last_name,
          },
        },
      })

      return { data: authData, error: authError }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Create profile after email confirmation (called from auth state change)
   */
  static async createProfileFromSession(user: unknown, signUpData?: SignUpData): Promise<AuthResponse> {
    try {
      // Type guard for user object
      if (typeof user !== 'object' || !user || !('id' in user) || !('email' in user)) {
        return { data: null, error: { message: 'Invalid user object' } }
      }

      const userId = (user as Record<string, unknown>).id as string
      const userEmail = (user as Record<string, unknown>).email as string
      const userMetadata = ((user as Record<string, unknown>).user_metadata as Record<string, unknown>) || {}

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (existingProfile) {
        return { data: existingProfile, error: null }
      }

      // Create profile from user metadata or provided data
      const profileData: ProfileInsert = {
        id: userId,
        email: userEmail,
        first_name: signUpData?.first_name || (userMetadata.first_name as string) || '',
        last_name: signUpData?.last_name || (userMetadata.last_name as string) || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Sign in existing user
   */
  static async signIn(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<AuthResponse<void>> {
    const { error } = await supabase.auth.signOut()
    return { data: null, error }
  }

  /**
   * Resend confirmation email
   */
  static async resendConfirmation(email: string): Promise<AuthResponse<void>> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    return { data: null, error }
  }

  /**
   * Get current session
   */
  static async getSession() {
    return await supabase.auth.getSession()
  }

  /**
   * Set up auth state change listener
   */
  static onAuthStateChange(callback: (event: string, session: unknown) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}
