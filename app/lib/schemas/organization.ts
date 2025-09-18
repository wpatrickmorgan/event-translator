import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s&.,-]+$/, 'Organization name contains invalid characters'),
  address_line_1: z.string()
    .min(5, 'Address line 1 must be at least 5 characters')
    .max(100, 'Address line 1 must be less than 100 characters'),
  address_line_2: z.string()
    .max(100, 'Address line 2 must be less than 100 characters')
    .optional()
    .nullable(),
  city: z.string()
    .min(2, 'City must be at least 2 characters')
    .max(50, 'City must be less than 50 characters')
    .regex(/^[a-zA-Z\s.-]+$/, 'City name contains invalid characters'),
  state: z.string()
    .min(2, 'State must be at least 2 characters')
    .max(50, 'State must be less than 50 characters')
    .regex(/^[a-zA-Z\s.-]+$/, 'State name contains invalid characters'),
  zip_code: z.string()
    .min(5, 'ZIP code must be at least 5 characters')
    .max(10, 'ZIP code must be less than 10 characters')
    .regex(/^[0-9-]+$/, 'ZIP code can only contain numbers and hyphens'),
})

export type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>
