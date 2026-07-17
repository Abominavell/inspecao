import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID || "common";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      // Authorization Code + PKCE (Auth.js / OIDC)
      checks: ["pkce", "state"],
      authorization: {
        params: {
          // Gate corporativo: id_token basta (openid/profile/email). Scope de API opcional.
          scope: [
            "openid",
            "profile",
            "email",
            "offline_access",
            process.env.AUTH_ENTRA_API_SCOPE || "",
          ]
            .filter(Boolean)
            .join(" "),
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.entraAccessToken = account.access_token;
        token.entraExpiresAt = account.expires_at;
      }
      if (account?.id_token) {
        token.entraIdToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.entraAccessToken = token.entraAccessToken as string | undefined;
      session.entraIdToken = token.entraIdToken as string | undefined;
      session.entraExpiresAt = token.entraExpiresAt as number | undefined;
      return session;
    },
  },
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
