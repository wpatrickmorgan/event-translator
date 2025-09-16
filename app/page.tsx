'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { UserProfile } from '@/components/user-profile'
import { Button } from '@/components/ui/button'
import { LogIn, User } from 'lucide-react'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const { user, loading } = useAuth()

  useEffect(() => {
    const testConnection = async () => {
      // Test connection by checking if we can access the profiles table
      const { error } = await supabase.from('profiles').select('count').limit(1)
      setConnected(!error) // Will be false initially, that's fine
    }
    testConnection()
  }, [])

  if (loading) {
    return (
      <main className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Event Translator</h1>
            <p className="text-lg text-gray-600">
              Supabase Connection: {connected ? '✅ Connected' : '🔄 Setting up...'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span className="text-sm">{user.email}</span>
              </div>
            ) : (
              <Button onClick={() => window.location.href = '/auth'}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>

        {user ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Welcome back!</h2>
              <p className="text-gray-600 mb-6">
                You&apos;re successfully signed in. Here&apos;s what you can do next:
              </p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Create new events</li>
                <li>Manage your translations</li>
                <li>View your event history</li>
                <li>Update your profile settings</li>
              </ul>
            </div>
            
            <div>
              <UserProfile />
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Sign up or sign in to start creating and managing your events with real-time translations.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => window.location.href = '/auth'} size="lg">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In / Sign Up
              </Button>
            </div>
          </div>
        )}

        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Next Steps</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Create database tables for events and translations</li>
            <li>Build event creation and management interface</li>
            <li>Add real-time translation features</li>
            <li>Implement user preferences and settings</li>
          </ul>
        </div>
      </div>
    </main>
  )
}