/**
 * Supabase Server Client
 *
 * This client is used server-side for authenticated operations.
 * Uses the service role key for administrative operations.
 * Never expose this to the browser.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv, serverEnv } from "./config";

/**
 * Create a Supabase server client for route handlers
 * This client can refresh sessions and access protected data
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

export const createServerSupabaseClient = createClient;

/**
 * Create a Supabase admin client for server-side operations
 * Uses the service role key for elevated permissions
 * Use only for operations that require admin privileges
 */
export async function createAdminSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignore errors from setting cookies in Server Components
          }
        },
      },
    },
  );
}
