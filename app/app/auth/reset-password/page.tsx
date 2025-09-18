'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'request' | 'reset'>('request')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updating, setUpdating] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const exchanged = useRef(false)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  useEffect(() => {
    const run = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
      const typeInHash = hashParams.get('type')
      const typeInQuery = searchParams.get('type')
      const code = searchParams.get('code')

      const switchToReset = () => {
        setMode('reset')
        if (hash) window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      }

      if (typeInHash === 'recovery' || typeInQuery === 'recovery') switchToReset()

      // Skip if we already have a session or already exchanged
      const { data: sess } = await supabase.auth.getSession()
      if (sess.session || exchanged.current) return

      if (code) {
        exchanged.current = true
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (!error) {
          switchToReset()
          const url = new URL(window.location.href)
          url.searchParams.delete('code')
          window.history.replaceState({}, document.title, url.pathname + (url.search || ''))
        }
      }
    }
    run()
  }, [searchParams])

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?type=recovery`
      })
      
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Password reset email sent! Check your inbox.')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setUpdating(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Password updated. You are now signed in.')
      await supabase.auth.getSession() // ensure client has session cookies
      router.replace('/')              // no refresh; lets middleware run cleanly
    } catch {
      toast.error('Failed to update password')
    } finally {
      setUpdating(false)
    }
  }

  if (mode === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Set a New Password</h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter a new password to complete your reset
            </p>
          </div>

          <Card className="w-full">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Create New Password</CardTitle>
              <CardDescription className="text-center">
                Your session has been verified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    New Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={updating}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm_password" className="text-sm font-medium">
                    Confirm Password
                  </label>
                  <Input
                    id="confirm_password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={updating}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={updating}>
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => router.push('/auth')}
                  disabled={updating}
                >
                  Back to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we&apos;ll send you a link to reset your password
          </p>
        </div>
        
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              We&apos;ll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Email
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => router.push('/auth')}
                disabled={loading}
              >
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
