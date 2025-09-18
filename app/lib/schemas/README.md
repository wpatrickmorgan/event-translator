# Schemas Directory

This directory contains Zod validation schemas for forms and API endpoints.

## Approach

We use **manual Zod schemas** with **snake_case field names** throughout the project for consistency with our database schema.

### Why Snake Case?

- ✅ **Database consistency** - matches SQL/PostgreSQL conventions
- ✅ **No data transformation** - direct mapping from forms to database
- ✅ **Simpler code** - no field name conversion needed
- ✅ **Better performance** - no transformation overhead
- ✅ **Less error-prone** - no field mapping mistakes

## Files

- `auth.ts` - Authentication form schemas (signup, signin, reset password)

## Database Consistency

The schemas use snake_case field names that directly match the database schema:
- `first_name` → `profiles.first_name`
- `last_name` → `profiles.last_name`
- `confirm_password` → form validation only

## Example Usage

```typescript
import { signUpSchema } from '@/lib/schemas/auth'

// Validate form data
const result = signUpSchema.safeParse(formData)
if (!result.success) {
  // Handle validation errors
  console.log(result.error.issues)
}

// Direct database insertion (no transformation needed)
const profileData: Database['public']['Tables']['profiles']['Insert'] = {
  id: userId,
  email: result.data.email,
  first_name: result.data.first_name,  // Direct mapping!
  last_name: result.data.last_name,    // Direct mapping!
}
```
