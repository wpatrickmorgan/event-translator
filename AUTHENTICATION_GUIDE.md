# Authentication Flow Guide

## Current Implementation

Event Translator uses **Zustand + Supabase** with a multi-tenant organization system.

### User Flow
1. **Direct Signup** → Email confirmation → Organization creation → App access (admin)
2. **Future**: Invitation system for adding users to existing organizations

### Tech Stack
- **State**: Zustand store (`lib/stores/authStore.ts`)
- **Business Logic**: Services pattern (`lib/services/`)
- **Auth**: Supabase Auth + custom organization flow
- **Types**: Database types + domain layer (`lib/types/auth.ts`)

## Components

### Authentication
- `components/auth-form.tsx` - Sign in/up form
- `app/auth/confirm/page.tsx` - Email confirmation handling
- `app/auth/reset-password/page.tsx` - Password reset

### Organization Setup
- `app/onboarding/create-organization/page.tsx` - Organization creation with address

### User Management
- `components/user-profile.tsx` - User info and sign out

## Usage Patterns

### State Management
```typescript
// ✅ Use selective subscriptions
const user = useAuthStore(state => state.user)
const userState = useAuthStore(state => state.userState)

// ✅ Call services for actions
const result = await AuthService.signIn(email, password)
```

### Error Handling
```typescript
// ✅ Type-safe error handling
import { hasErrorMessage } from '@/lib/types/auth'

if (error && hasErrorMessage(error)) {
  toast.error(error.message)
} else if (error) {
  toast.error('Operation failed')
}
```

## User States

- `not_signed_up` - No account
- `unconfirmed` - Account exists, email not confirmed
- `confirmed_no_organization` - Confirmed but needs to create org
- `confirmed_with_organization` - Full access

## Key Rules

- **Profiles created AFTER email confirmation** (avoids RLS issues)
- **One organization per admin account**
- **Use `router.push()` not `window.location.href`**
- **Services handle business logic, store handles state only**

---

*See AGENTS.md for complete development guidelines.*
