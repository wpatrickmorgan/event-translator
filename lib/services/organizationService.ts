import { supabase } from '@/lib/supabase'
import { ROLES } from '@/lib/constants/roles'
import type { CreateOrganizationData, AuthResponse, OrganizationInsert, UserOrganization } from '@/lib/types/auth'

export class OrganizationService {
  /**
   * Create a new organization and assign user as admin
   */
  static async createOrganization(
    userId: string,
    organizationData: CreateOrganizationData
  ): Promise<AuthResponse> {
    try {
      // Generate slug from organization name
      const slug = this.generateSlug(organizationData.name)

      // Create organization
      const orgInsert: OrganizationInsert = {
        name: organizationData.name,
        slug,
        address_line_1: organizationData.address_line_1,
        address_line_2: organizationData.address_line_2,
        city: organizationData.city,
        state: organizationData.state,
        zip_code: organizationData.zip_code,
        created_by: userId,
      }

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert(orgInsert)
        .select()
        .single()

      if (orgError) return { data: null, error: orgError }

      // Add user to organization as admin
      const { error: userOrgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          organization_id: orgData.id,
          role: ROLES.ADMIN,
        })

      if (userOrgError) return { data: null, error: userOrgError }

      return { data: orgData, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Check if user can create an organization
   */
  static canCreateOrganization(userOrganizations: UserOrganization[]): boolean {
    return userOrganizations.length === 0
  }

  /**
   * Generate URL-friendly slug from organization name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * Get organization by ID
   */
  static async getOrganization(organizationId: string) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    return { data, error }
  }

  /**
   * Get organization members
   */
  static async getOrganizationMembers(organizationId: string) {
    const { data, error } = await supabase
      .from('user_organizations')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('organization_id', organizationId)

    return { data, error }
  }
}
