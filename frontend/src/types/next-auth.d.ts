import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    entraAccessToken?: string;
    entraExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    entraAccessToken?: string;
    entraExpiresAt?: number;
    entraIdToken?: string;
  }
}
