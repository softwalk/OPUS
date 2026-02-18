import NextAuth from "next-auth";
import { fullAuthConfig } from "./auth-options";

export const { handlers, auth, signIn, signOut } = NextAuth(fullAuthConfig);
