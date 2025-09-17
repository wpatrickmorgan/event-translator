'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Building } from 'lucide-react'
import { createOrganizationSchema, type CreateOrganizationFormData } from '@/lib/schemas/organization'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

export default function CreateOrganizationPage() {
  const router = useRouter()
  const { userState, loading, createOrganization } = useAuth()

  const form = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      zip_code: '',
    },
    mode: 'onBlur',
  })

  const { handleSubmit, formState: { isSubmitting }, register, formState: { errors } } = form

  // Redirect if user is not in the right state
  useEffect(() => {
    if (!loading) {
      if (userState === 'not_signed_up' || userState === 'unconfirmed') {
        router.push('/auth')
      } else if (userState === 'confirmed_with_organization') {
        router.push('/')
      }
    }
  }, [userState, loading, router])

  const onSubmit = async (data: CreateOrganizationFormData) => {
    try {
      const { error } = await createOrganization(
        data.name,
        data.address_line_1,
        data.address_line_2 || null,
        data.city,
        data.state,
        data.zip_code
      )

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Organization created successfully!')
        router.push('/')
      }
    } catch {
      toast.error('An unexpected error occurred')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Building className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Create Your Organization</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set up your organization to get started with Event Translator
          </p>
        </div>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Organization Details</CardTitle>
            <CardDescription>
              Enter your organization information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Organization Name *
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter organization name"
                  {...register('name')}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="address_line_1" className="text-sm font-medium">
                  Address Line 1 *
                </label>
                <Input
                  id="address_line_1"
                  type="text"
                  placeholder="Enter street address"
                  {...register('address_line_1')}
                  disabled={isSubmitting}
                />
                {errors.address_line_1 && (
                  <p className="text-sm text-red-600">{errors.address_line_1.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="address_line_2" className="text-sm font-medium">
                  Address Line 2
                </label>
                <Input
                  id="address_line_2"
                  type="text"
                  placeholder="Apartment, suite, etc. (optional)"
                  {...register('address_line_2')}
                  disabled={isSubmitting}
                />
                {errors.address_line_2 && (
                  <p className="text-sm text-red-600">{errors.address_line_2.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="city" className="text-sm font-medium">
                    City *
                  </label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="Enter city"
                    {...register('city')}
                    disabled={isSubmitting}
                  />
                  {errors.city && (
                    <p className="text-sm text-red-600">{errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="state" className="text-sm font-medium">
                    State *
                  </label>
                  <Input
                    id="state"
                    type="text"
                    placeholder="Enter state"
                    {...register('state')}
                    disabled={isSubmitting}
                  />
                  {errors.state && (
                    <p className="text-sm text-red-600">{errors.state.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="zip_code" className="text-sm font-medium">
                  ZIP Code *
                </label>
                <Input
                  id="zip_code"
                  type="text"
                  placeholder="Enter ZIP code"
                  {...register('zip_code')}
                  disabled={isSubmitting}
                />
                {errors.zip_code && (
                  <p className="text-sm text-red-600">{errors.zip_code.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Organization
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            * Required fields
          </p>
        </div>
      </div>
    </div>
  )
}
