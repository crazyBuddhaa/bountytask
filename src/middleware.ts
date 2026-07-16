import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PROTECTED_ROUTES = ["/dashboard", "/admin"];
const AUTH_ROUTES = ["/sign-in", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Response we'll mutate as Supabase refreshes/reads cookies, then
  // ultimately return (or replace with a redirect further down).
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Cookies must be written to both the request (so this same
          // middleware invocation sees the refreshed values) and the
          // response (so the browser actually receives them).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this validates the session against Supabase (and refreshes
  // it if the access token is expiring) rather than just checking whether
  // a cookie happens to exist. A cookie can be present but the session it
  // refers to invalid/expired — trusting presence alone causes an infinite
  // redirect loop between protected routes and /sign-in.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Long-lived anonymous visitor id used for website traffic analytics
  // (distinct from the auth session). Assigned once, reused across visits.
  if (!request.cookies.get("bt_vid")?.value) {
    response.cookies.set("bt_vid", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400, // ~13 months
    });
  }

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

  return response;
}

export const config = {
  matcher: [
    // Exclude static assets, images, and service-worker files from middleware
    // so they are served directly without a Supabase auth roundtrip.
    "/((?!_next/static|_next/image|favicon.ico|sw_[^/]+\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
