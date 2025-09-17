'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, userState, loading, resendConfirmation } = useAuth()

  useEffect(() => {
    // Handle the confirmation and routing based on user state
    if (!loading && user) {
      if (userState === 'confirmed_no_organization') {
        // Direct signup user - needs to create organization
        router.push('/onboarding/create-organization')
      } else if (userState === 'confirmed_with_organization') {
        // Invited user or user with existing org - go to app
        router.push('/')
      }
    }
  }, [user, userState, loading, router])

  const handleResendConfirmation = async () => {
    const { error } = await resendConfirmation()
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Confirmation email sent! Please check your inbox.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Verifying your account...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show confirmation status
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Confirmation Failed</CardTitle>
            <CardDescription>
              {errorDescription || 'There was an error confirming your email address.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Don&apos;t worry, you can request a new confirmation link.
            </p>
            <Button 
              onClick={handleResendConfirmation} 
              className="w-full"
              disabled={!user?.email}
            >
              <Mail className="mr-2 h-4 w-4" />
              Request New Confirmation Link
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/auth')} 
              className="w-full"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (userState === 'unconfirmed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We sent a confirmation link to {user?.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Click the link in your email to confirm your account and continue.
            </p>
            <Button onClick={handleResendConfirmation} variant="outline" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Resend Confirmation Email
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => router.push('/auth')} 
              className="w-full"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - will redirect automatically via useEffect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-green-600">Email Confirmed!</CardTitle>
          <CardDescription>
            Your email has been successfully confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Redirecting you...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  )
}
