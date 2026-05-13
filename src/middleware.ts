import createMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function safeInternalPath(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw?.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

function stripLocalePrefix(pathname: string): { locale: string | null; path: string } {
  const segs = pathname.split("/").filter(Boolean);
  const first = segs[0];
  if (first && routing.locales.includes(first as "en" | "bg")) {
    const rest = segs.slice(1);
    return { locale: first, path: rest.length ? `/${rest.join("/")}` : "/" };
  }
  return { locale: null, path: pathname };
}

async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  if (!supabaseUrl?.trim() || !supabaseKey?.trim()) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const { locale, path: pathWithoutLocale } = stripLocalePrefix(pathname);

  const isAuthPage = pathWithoutLocale === "/login" || pathWithoutLocale === "/signup";
  const isDashboard =
    pathWithoutLocale === "/dashboard" || pathWithoutLocale.startsWith("/dashboard/");
  const isAdmin =
    pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");

  if ((isDashboard || isAdmin) && !user) {
    const loc = locale ?? routing.defaultLocale;
    const loginUrl = new URL(`/${loc}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    const target = safeInternalPath(
      request.nextUrl.searchParams.get("redirect") ?? request.nextUrl.searchParams.get("next")
    );
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    let response = NextResponse.next({ request });
    return refreshSupabaseSession(request, response);
  }

  if (pathname.startsWith("/auth")) {
    let response = NextResponse.next({ request });
    return refreshSupabaseSession(request, response);
  }

  const response = intlMiddleware(request);
  return refreshSupabaseSession(request, response);
}

export const config = {
  matcher: ["/", "/(bg|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
