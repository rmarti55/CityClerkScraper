import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts, sessions, verificationTokens } from "./db/schema";
import { sendMagicLinkEmail } from "@/emails/magic-link";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    {
      id: "resend",
      name: "Email",
      type: "email",
      maxAge: 24 * 60 * 60, // Magic link expires in 24 hours
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail({ identifier, url });
      },
    },
  ],
  session: {
    strategy: "database",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh session every 24 hours
  },
  pages: {
    signIn: "/", // Redirect to home page for sign in
    verifyRequest: "/auth/verify", // Magic link sent page
    error: "/auth/error", // Error page
  },
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
