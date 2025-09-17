# Event Translator - Agent Guidelines

Essential information for AI agents working on this Next.js 15 + Supabase multi-tenant SaaS application.

## Tech Stack
- **Next.js 15** (App Router), React 19, TypeScript
- **Zustand** state management (clean architecture)
- **Supabase** auth + database
- **Tailwind CSS 4** + shadcn/ui components
- **Deployed on Vercel** (no local dev environment)

## Essential Commands
```bash
npm run build        # ALWAYS run before committing - validates TypeScript
npm run lint         # Check for linting errors
```

## Architecture

### Clean Architecture Implementation

We use **clean architecture** with strict separation of concerns:

```
lib/
├── stores/           # Zustand stores (state-only, ~100 lines max)
├── services/         # Business logic & API calls
│   ├── authService.ts       # Authentication operations
│   ├── userService.ts       # User data operations  
│   └── organizationService.ts # Organization operations
├── types/            # Domain types (re-exports from database)
└── constants/        # App constants (roles, etc.)
```

### Key Principles
- **Stores**: State management only, NO business logic
- **Services**: API calls, business logic, data transformation
- **Components**: UI logic + call services + read stores
- **Types**: Database types + domain-specific types

## Database Schema (Reference Only - Changes Made in Supabase)

**Core Tables:**
- `profiles` - User profile data (created after email confirmation)
- `organizations` - Organization data with full address
- `user_organizations` - Junction table with roles (admin/user)

**Address Fields:** `address_line_1`, `address_line_2`, `city`, `state`, `zip_code`

## Authentication Flow

### User States
```typescript
type UserState = 
  | 'not_signed_up'              // No user account
  | 'unconfirmed'                // User exists, email not confirmed
  | 'confirmed_no_organization'  // Email confirmed, no org (direct signup)
  | 'confirmed_with_organization' // Fully set up with org access
```

### Direct Signup Flow
1. User signs up → `unconfirmed` (NO profile created yet)
2. Email confirmation → Profile created → `confirmed_no_organization`
3. Create organization → Admin role → `confirmed_with_organization`
4. Access to main app

### Critical Auth Rules
- **Profiles are created AFTER email confirmation** (avoids RLS issues)
- **User state logic**: Don't block on profile existence, only email confirmation + org membership
- **One organization per admin account** (enforced in services)
- **RLS policies**: Avoid circular references between tables

## State Management with Zustand

### Store Structure
```typescript
// ✅ Good: State-only store (~100 lines)
interface AuthStore {
  // State
  user: User | null
  profile: Profile | null
  loading: boolean
  
  // Computed values  
  userState: UserState
  hasOrganization: boolean
  
  // Simple setters only
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}
```

### Component Usage
```typescript
// ✅ Selective subscriptions for performance
const user = useAuthStore(state => state.user)
const loading = useAuthStore(state => state.loading)

// ✅ Use services for business logic
const { error } = await AuthService.signIn(email, password)
```

## Next.js Best Practices

**Navigation**
✅ **Use**: `router.push('/path')`
❌ **Never**: `window.location.href = '/path'`

## Error Handling

**Type-Safe Error Handling**
```typescript
// ✅ Use type guards instead of 'any'
export function hasErrorMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error
}

// Usage
if (error && hasErrorMessage(error)) {
  toast.error(error.message)
} else if (error) {
  toast.error('Operation failed')
}
```

## Common Issues & Solutions

### 1. Multiple API Calls
**Problem**: Multiple components creating duplicate auth state
**Solution**: Use Zustand with selective subscriptions

### 2. RLS Infinite Recursion  
**Problem**: Policies referencing same table
**Solution**: Simple policies, avoid circular references

### 3. Profile Creation RLS Errors
**Problem**: Creating profiles during signup
**Solution**: Create profiles AFTER email confirmation

### 4. TypeScript 'any' Types
**Problem**: External API responses are unknown
**Solution**: Use type guards for safe type checking

## Development Workflow

1. **Planning**: Use `todo_write` tool to plan tasks
2. **Implementation**: Services first, then components
3. **Testing**: `npm run build` to verify TypeScript
4. **Review**: Check for RLS issues, performance, best practices

## Key Learnings

- **Profile creation timing is critical** for RLS compliance
- **User state logic should be simple** and not block on profile existence  
- **Zustand stores should be minimal** (~100 lines max)
- **Services pattern enables clean testing** and separation of concerns
- **Next.js router.push()** is essential for proper navigation
- **Type guards are better than 'any'** for external API responses

## Future Enhancements (Not Implemented Yet)

- **Invitation System**: Server-side API routes + admin UI
- **User Management**: Admin controls for organization users
- **Organization Settings**: Additional org configuration options

---

**Remember**: Always maintain clean architecture, avoid circular RLS references, and use Next.js best practices. The authentication flow is the foundation - handle it carefully!
