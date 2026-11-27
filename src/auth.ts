import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

export function isOAuthConfigured(): boolean {
  return providers.length > 0;
}

export function isPublicMode(): boolean {
  return (
    process.env.PUBLIC_MODE === "true" ||
    process.env.NODE_ENV === "production"
  );
}

export function isAuthEnforced(): boolean {
  return isPublicMode() || isOAuthConfigured();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "readycv-local-dev-secret-do-not-use-in-prod"
      : undefined),
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        token.userId = `${account.provider}:${account.providerAccountId}`;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id =
          (token.userId as string | undefined) ||
          token.sub ||
          session.user.email ||
          "";
      }
      return session;
    },
  },
});

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  isLocalFallback: boolean;
}

export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  if (!isAuthEnforced()) {
    return {
      id: "local-user",
      name: "Local Dev",
      email: "local@localhost",
      isLocalFallback: true,
    };
  }

  const session = await auth();
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) return null;

  return {
    id: userId,
    name: session?.user?.name || "Signed-in User",
    email: session?.user?.email || "",
    isLocalFallback: false,
  };
}

export class UnauthorizedError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getOptionalUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
