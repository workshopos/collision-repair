/**
 * WorkShopOS Environment Configuration
 *
 * This module provides typed access to environment variables with validation.
 * Server-only variables are never exposed to the browser.
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * Public environment variables (safe to expose to browser)
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

/**
 * Server-only environment variables (never exposed to browser)
 */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

/**
 * Validate environment configuration
 * Throws if required variables are missing
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  if (!publicEnv.supabaseUrl) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  if (!publicEnv.supabaseAnonKey) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }

  if (isProduction && !serverEnv.supabaseServiceRoleKey) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is not set in production");
  }

  if (errors.length > 0) {
    throw new Error(`Environment configuration invalid:\n${errors.join("\n")}`);
  }
}
