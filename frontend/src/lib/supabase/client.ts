import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a dummy client during SSR prerendering when env vars are unavailable.
    // This only happens during `next build` for static pages like /_not-found.
    // At runtime, the env vars will always be present.
    throw new Error('Supabase env vars not set — this should only happen during build prerender.')
  }

  return createBrowserClient(url, key)
}
