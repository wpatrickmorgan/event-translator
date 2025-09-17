// hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'
import { ROLES } from '@/lib/constants/roles'

// Define types directly from database schema
type Profile = Database['public']['Tables']['profiles']['Row']
type UserOrganization = Database['public']['Tables']['user_organizations']['Row']
type Organization = Database['public']['Tables']['organizations']['Row']

export type UserState = 
  | 'not_signed_up'
  | 'unconfirmed'
  | 'confirmed_no_organization'
  | 'confirmed_with_organization'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setProfile(null)
        setUserOrganizations([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // Fetch user organizations with organization details
      const { data: orgsData, error: orgsError } = await supabase
        .from('user_organizations')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)

      if (orgsError) throw orgsError
      setUserOrganizations(orgsData || [])
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, first_name: string, last_name: string) => {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: first_name,
            last_name: last_name,
          },
        },
      })

      if (authError) return { data: authData, error: authError }

      // 2. Create profile record if user was created
      if (authData.user) {
        const profileData: Database['public']['Tables']['profiles']['Insert'] = {
          id: authData.user.id,
          email: email,
          first_name: first_name,
          last_name: last_name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .insert(profileData)

        if (profileError) {
          console.error('Error creating profile:', profileError)
          return { data: authData, error: profileError }
        }
      }

      return { data: authData, error: null }
    } catch (error) {
      return { data: null, error: error as any }
    }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const hasOrganization = userOrganizations.length > 0

  // User state detection
  const getUserState = (): UserState => {
    if (!user) return 'not_signed_up'
    if (!user.email_confirmed_at) return 'unconfirmed'
    if (!profile) return 'unconfirmed' // Profile not created yet
    if (!hasOrganization) return 'confirmed_no_organization'
    return 'confirmed_with_organization'
  }

  const createOrganization = async (
    name: string,
    address_line_1: string,
    address_line_2: string | null,
    city: string,
    state: string,
    zip_code: string
  ) => {
    if (!user || !profile) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    // Check if user already has an organization
    if (hasOrganization) {
      return { data: null, error: { message: 'You can only create one organization per admin account at this time' } }
    }

    try {
      // Generate slug from organization name
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name,
          slug,
          address_line_1,
          address_line_2,
          city,
          state,
          zip_code,
          created_by: user.id,
        })
        .select()
        .single()

      if (orgError) return { data: null, error: orgError }

      // Add user to organization as admin
      const { error: userOrgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: orgData.id,
          role: ROLES.ADMIN,
        })

      if (userOrgError) return { data: null, error: userOrgError }

      // Refresh user data
      await fetchUserData(user.id)

      return { data: orgData, error: null }
    } catch (error) {
      return { data: null, error: error as any }
    }
  }

  const resendConfirmation = async () => {
    if (!user?.email) {
      return { error: { message: 'No email found' } }
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    })

    return { error }
  }

  return {
    user,
    profile,
    userOrganizations,
    loading,
    signUp,
    signIn,
    signOut,
    hasOrganization,
    userState: getUserState(),
    createOrganization,
    resendConfirmation,
    refetchUserData: () => user && fetchUserData(user.id),
  }
}