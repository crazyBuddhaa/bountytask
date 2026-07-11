import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/admin"];
const AUTH_ROUTES = ["/sign-in", "/register"];

/**
 * Check for a Supabase session cookie.
 * @supabase/ssr stores the session in cookies named:
 *   sb-<project-ref>-auth-token  (or chunked as .0, .1, …)
 * We don't need to verify the JWT here — server components do that.
 * Middleware only needs to decide whether to redirect for UX purposes.
 */
function hasAuthCookie(request: NextRequest): boolean {
  for (const name of request.cookies.getAll().map((c) => c.name)) {
    if (name.startsWith("sb-") && name.includes("-auth-token")) {
      return true;
    }
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = hasAuthCookie(request);

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (isProtected && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  if (isAuthRoute && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
