'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthService } from '@/lib/services/authService'
import { hasErrorMessage } from '@/lib/types/auth'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { signUpSchema, signInSchema, type SignUpFormData, type SignInFormData } from '@/lib/schemas/auth'
import toast from 'react-hot-toast'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
}

export function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  // No need to get functions from store - use services directly

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  })

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
    mode: 'onBlur',
  })

  const currentForm = mode === 'signup' ? signUpForm : signInForm
  const { handleSubmit, formState: { isSubmitting }, reset } = currentForm

  const onSubmit = async (data: SignUpFormData | SignInFormData) => {
    try {
      if (mode === 'signin') {
        const { error } = await AuthService.signIn(data.email, data.password)
        if (error && hasErrorMessage(error)) {
          toast.error(error.message)
        } else if (error) {
          toast.error('Sign in failed')
        } else {
          toast.success('Welcome back!')
          router.push('/')
          router.refresh()
        }
      } else {
        const signUpData = data as SignUpFormData
        const { error } = await AuthService.signUp(signUpData)
        if (error && hasErrorMessage(error)) {
          toast.error(error.message)
        } else if (error) {
          toast.error('Sign up failed')
        } else {
          toast.success('Check your email for the confirmation link!')
          reset() // Clear form after successful signup
        }
      }
    } catch (_err) {
      toast.error('An unexpected error occurred')
    }
  }

  const handleForgotPassword = async () => {
    const email = mode === 'signup' ? signUpForm.getValues('email') : signInForm.getValues('email')
    if (!email) {
      toast.error('Please enter your email address first')
      return
    }

    // Navigate to reset password page with email prefilled
    const params = new URLSearchParams({ email })
    router.push(`/auth/reset-password?${params.toString()}`)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </CardTitle>
        <CardDescription className="text-center">
          {mode === 'signin' 
            ? 'Enter your credentials to access your account'
            : 'Create a new account to get started'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <label htmlFor="first_name" className="text-sm font-medium">
                  First Name
                </label>
                <Input
                  id="first_name"
                  type="text"
                  placeholder="Enter your first name"
                  {...signUpForm.register('first_name')}
                  disabled={isSubmitting}
                />
                {signUpForm.formState.errors.first_name && (
                  <p className="text-sm text-red-600">{signUpForm.formState.errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="last_name" className="text-sm font-medium">
                  Last Name
                </label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Enter your last name"
                  {...signUpForm.register('last_name')}
                  disabled={isSubmitting}
                />
                {signUpForm.formState.errors.last_name && (
                  <p className="text-sm text-red-600">{signUpForm.formState.errors.last_name.message}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
                  {...(mode === 'signup' ? signUpForm.register('email') : signInForm.register('email'))}
              disabled={isSubmitting}
            />
            {(mode === 'signup' ? signUpForm.formState.errors.email : signInForm.formState.errors.email) && (
              <p className="text-sm text-red-600">{(mode === 'signup' ? signUpForm.formState.errors.email : signInForm.formState.errors.email)?.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                  {...(mode === 'signup' ? signUpForm.register('password') : signInForm.register('password'))}
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {(mode === 'signup' ? signUpForm.formState.errors.password : signInForm.formState.errors.password) && (
              <p className="text-sm text-red-600">{(mode === 'signup' ? signUpForm.formState.errors.password : signInForm.formState.errors.password)?.message}</p>
            )}
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="confirm_password" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="Confirm your password"
                {...signUpForm.register('confirm_password')}
                disabled={isSubmitting}
              />
              {signUpForm.formState.errors.confirm_password && (
                <p className="text-sm text-red-600">{signUpForm.formState.errors.confirm_password.message}</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </Button>

          {mode === 'signin' && (
            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={handleForgotPassword}
              disabled={isSubmitting}
            >
              Forgot your password?
            </Button>
          )}
        </form>

        <div className="mt-6 text-center text-sm">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => {
                  onModeChange('signup')
                  signInForm.reset()
                  signUpForm.reset()
                }}
                disabled={isSubmitting}
              >
                Sign up
              </Button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => {
                  onModeChange('signin')
                  signInForm.reset()
                  signUpForm.reset()
                }}
                disabled={isSubmitting}
              >
                Sign in
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
