// hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

// Define types directly from database schema
type Profile = Database['public']['Tables']['profiles']['Row']
type UserOrganization = Database['public']['Tables']['user_organizations']['Row']
type Organization = Database['public']['Tables']['organizations']['Row']

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

  return {
    user,
    profile,
    userOrganizations,
    loading,
    signUp,
    signIn,
    signOut,
    hasOrganization,
    refetchUserData: () => user && fetchUserData(user.id),
  }
}