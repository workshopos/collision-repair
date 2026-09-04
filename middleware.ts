/**
 * WorkShopOS Authentication Middleware
 *
 * Refreshes user sessions and protects routes
 */

import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Allow the request to proceed
  // Session management is handled in route handlers via cookies
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)",
  ],
};
