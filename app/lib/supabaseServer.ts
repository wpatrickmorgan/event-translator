import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: { [key: string]: unknown }) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: { [key: string]: unknown }) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
