/**
 * Supabase Browser Client
 *
 * This client is used in the browser for client-side operations.
 * It uses the public anon key and should never contain the service role key.
 */

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "./config";

let supabaseClient: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Get or create the Supabase browser client
 * Safe to use in components and client-side code
 */
export function getSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseClient can only be called in the browser");
  }

  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      publicEnv.supabaseUrl,
      publicEnv.supabaseAnonKey,
    );
  }

  return supabaseClient;
}
