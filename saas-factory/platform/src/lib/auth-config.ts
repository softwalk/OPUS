import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no Prisma imports).
 * Used by middleware for route protection.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicRoutes = ["/", "/login", "/register"];
      const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isPublicApi = nextUrl.pathname === "/api/v1/blueprints";

      if (isPublicRoute || isApiAuth || isPublicApi) return true;
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [], // providers added in full config (auth-options.ts)
} satisfies NextAuthConfig;
