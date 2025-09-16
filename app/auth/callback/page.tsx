'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AuthCallback() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }

        if (data.session) {
          setSuccess(true)
          setTimeout(() => router.push('/'), 2000)
        } else {
          setError('No session found')
        }
      } catch (_err) {
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-center">Confirming your email...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {success ? 'Email Confirmed!' : 'Confirmation Failed'}
          </CardTitle>
          <CardDescription>
            {success 
              ? 'Your email has been successfully confirmed. Redirecting...'
              : 'There was an issue confirming your email.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-4">
          {success ? (
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          ) : (
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
          )}
          
          {error && (
            <p className="text-red-600 text-center mb-4">{error}</p>
          )}
          
          {success ? (
            <p className="text-center text-gray-600">
              You will be redirected to the home page shortly.
            </p>
          ) : (
            <button
              onClick={() => router.push('/auth')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Return to Sign In
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
