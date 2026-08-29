import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/env";

/** Routes accessibles sans être connecté. */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/setup",
  // Lisibles sans compte : Google exige une politique de confidentialité
  // atteignable pour autoriser un client OAuth.
  "/confidentialite",
  "/conditions",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Proxy (ex-middleware, renommé en Next.js 16).
 *
 * Deux rôles :
 *  1. rafraîchir la session Supabase et réécrire les cookies sur la réponse ;
 *  2. rediriger vers /login toute requête non authentifiée hors zone publique.
 */
export async function proxy(request: NextRequest) {
  // Sans Supabase configuré, on laisse passer : la page d'accueil affiche l'écran de setup.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Empêche la mise en cache d'une réponse qui pose des cookies de session.
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // getUser() valide le jeton auprès du serveur Auth : ne pas remplacer par getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf : fichiers statiques, images optimisées, favicon, assets publics,
     * et les routes API qui ont leur propre authentification —
     * /api/v1 par clé API, /api/cron par CRON_SECRET, /api/webhooks par signature.
     * Les y soumettre à la garde de session les casserait : un appel machine
     * n'a pas de cookie, il serait redirigé vers /login.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/v1|api/cron|api/webhooks|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
