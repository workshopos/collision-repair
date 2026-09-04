/**
 * WorkShopOS Authentication Module
 *
 * Exports authentication utilities and configurations
 */

export { publicEnv, serverEnv, validateEnvironment } from "./config";
export { getSupabaseClient } from "./client";
export {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "./server";
export {
  AuthenticationRequiredError,
  getCurrentSession,
  getCurrentUser,
  isAuthenticated,
  requireAuthenticatedUser,
} from "./session";
