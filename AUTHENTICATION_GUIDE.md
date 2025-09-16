# Authentication Setup Guide

## Overview
This guide walks you through the complete signup/login flow implementation for your Event Translator app using Supabase as the backend.

## What's Been Implemented

### 1. Authentication Context (`lib/auth-context.tsx`)
- Centralized authentication state management
- Provides user session, loading states, and auth methods
- Handles automatic session restoration and auth state changes

### 2. Authentication Components
- **AuthForm** (`components/auth-form.tsx`): Unified signin/signup form with validation
- **UserProfile** (`components/user-profile.tsx`): User information display and sign out

### 3. Authentication Pages
- **Auth Page** (`app/auth/page.tsx`): Main authentication page with mode switching
- **Reset Password** (`app/auth/reset-password/page.tsx`): Password reset functionality

### 4. Middleware (`middleware.ts`)
- Automatic route protection
- Redirects unauthenticated users to `/auth`
- Redirects authenticated users away from auth pages

### 5. Updated Main App
- Integrated authentication into the main layout
- Conditional rendering based on auth state
- User profile display for authenticated users

## Supabase Setup Required

### 1. Environment Variables
Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Supabase Dashboard Configuration

#### Authentication Settings
1. Go to your Supabase project dashboard
2. Navigate to **Authentication > Settings**
3. Configure the following:

**Site URL**: `http://localhost:3000` (for development)

**Redirect URLs**: Add these URLs:
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`

#### Email Templates (Optional)
1. Go to **Authentication > Email Templates**
2. Customize the templates for:
   - Confirm signup
   - Reset password
   - Magic link

#### User Management
1. Go to **Authentication > Users**
2. Enable email confirmations if desired
3. Configure password requirements

## Features Included

### ✅ Sign Up
- Email and password validation
- Password confirmation
- Email verification (if enabled in Supabase)
- Success/error messaging

### ✅ Sign In
- Email and password authentication
- Remember me functionality (handled by Supabase)
- Error handling for invalid credentials

### ✅ Password Reset
- Email-based password reset
- Secure token generation
- Redirect to reset page

### ✅ User Profile
- Display user information
- Account status (verified/pending)
- Sign out functionality

### ✅ Route Protection
- Automatic redirects based on auth state
- Protected routes for authenticated users
- Public access to auth pages

### ✅ Session Management
- Automatic session restoration
- Real-time auth state updates
- Loading states during auth operations

## Usage Examples

### Using the Auth Context
```tsx
import { useAuth } from '@/lib/auth-context'

function MyComponent() {
  const { user, loading, signIn, signOut } = useAuth()
  
  if (loading) return <div>Loading...</div>
  
  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user.email}!</p>
          <button onClick={signOut}>Sign Out</button>
        </div>
      ) : (
        <button onClick={() => signIn('email@example.com', 'password')}>
          Sign In
        </button>
      )}
    </div>
  )
}
```

### Protected Routes
The middleware automatically handles route protection. Users will be redirected to `/auth` if not authenticated.

### Custom Auth Pages
You can create additional auth-related pages by:
1. Adding them to the `/app/auth/` directory
2. Updating the middleware matcher if needed
3. Using the `useAuth` hook for authentication logic

## Testing the Flow

1. **Start your development server**: `npm run dev`
2. **Visit the app**: Navigate to `http://localhost:3000`
3. **Test signup**: Click "Sign In / Sign Up" → Switch to "Sign Up" → Create account
4. **Test signin**: Use existing credentials to sign in
5. **Test password reset**: Click "Forgot your password?" → Enter email
6. **Test signout**: Click "Sign Out" in the user profile

## Next Steps

With authentication in place, you can now:

1. **Create user-specific data tables** in Supabase
2. **Build event management features** with user ownership
3. **Add user preferences and settings**
4. **Implement role-based access control**
5. **Add social authentication** (Google, GitHub, etc.)

## Troubleshooting

### Common Issues

1. **"Invalid login credentials"**
   - Check email/password are correct
   - Verify user exists in Supabase dashboard
   - Check if email confirmation is required

2. **Redirect loops**
   - Verify middleware configuration
   - Check Supabase redirect URLs
   - Ensure environment variables are set

3. **Session not persisting**
   - Check browser cookies/localStorage
   - Verify Supabase project settings
   - Check for JavaScript errors in console

### Debug Tips

1. Check Supabase dashboard for user activity
2. Use browser dev tools to inspect network requests
3. Check console for authentication errors
4. Verify environment variables are loaded correctly

## Security Considerations

- All authentication is handled server-side by Supabase
- Passwords are never stored in your app
- Sessions are managed securely by Supabase
- HTTPS is required for production deployments
- Consider implementing additional security measures like 2FA for production
