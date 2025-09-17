import { supabase } from '@/lib/supabase'
import type { Profile, UserOrganization } from '@/lib/types/auth'

export type UserData = {
  profile: Profile | null
  userOrganizations: UserOrganization[]
}

export class UserService {
  /**
   * Fetch user profile and organization data
   */
  static async fetchUserData(userId: string): Promise<UserData> {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
        return { profile: null, userOrganizations: [] }
      }

      // Fetch user organizations with organization details
      const { data: orgsData, error: orgsError } = await supabase
        .from('user_organizations')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)

      if (orgsError) {
        console.error('Error fetching user organizations:', orgsError)
        return { profile: profileData, userOrganizations: [] }
      }

      return {
        profile: profileData,
        userOrganizations: orgsData || []
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      return { profile: null, userOrganizations: [] }
    }
  }

  /**
   * Check if user has any organizations
   */
  static hasOrganization(userOrganizations: UserOrganization[]): boolean {
    return userOrganizations.length > 0
  }

  /**
   * Get user's current role in their organization
   */
  static getUserRole(userOrganizations: UserOrganization[]): string | null {
    return userOrganizations[0]?.role || null
  }

  /**
   * Get user's organization
   */
  static getUserOrganization(userOrganizations: UserOrganization[]) {
    // Note: organization data would need to be joined in the query
    // For now, return the organization_id
    return userOrganizations[0]?.organization_id || null
  }
}
