'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/stores/authStore'
import { AuthService } from '@/lib/services/authService'
import { LogOut, User, Mail, Calendar } from 'lucide-react'

export function UserProfile() {
  const user = useAuthStore(state => state.user)
  const profile = useAuthStore(state => state.profile)
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await AuthService.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
        <CardDescription>
          Your account information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {profile && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Name:</span>
                <span>{profile.first_name} {profile.last_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Email:</span>
                <span>{profile.email}</span>
              </div>
            </>
          )}
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Joined:</span>
            <span>{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              user.email_confirmed_at 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {user.email_confirmed_at ? 'Verified' : 'Pending Verification'}
            </span>
          </div>
        </div>

        <Button 
          onClick={handleSignOut} 
          variant="outline" 
          className="w-full"
          disabled={loading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </CardContent>
    </Card>
  )
}
