import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, UserRole } from "@/models/User";
import { loginSchema } from "@/lib/validations";

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}
class InactiveAccount extends CredentialsSignin {
  code = "account_disabled";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  // Auth.js aur proxy (route guard) dono same cookie name use karein
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
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidLogin();

        await connectDB();
        const user = await User.findOne({ email: parsed.data.email.toLowerCase() });

        // Same error for unknown email & wrong password (no account enumeration)
        if (!user) throw new InvalidLogin();
        const ok = await bcrypt.compare(parsed.data.password, user.password);
        if (!ok) throw new InvalidLogin();
        if (!user.isActive) throw new InactiveAccount();

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          facility: user.facility || "Main Medical Center",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.facility = user.facility;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.facility = token.facility as string;
      }
      return session;
    },
  },
});

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  facility?: string;
}

type AuthResult =
  | { user: AuthedUser; errorResponse: null }
  | { user: null; errorResponse: NextResponse };

/**
 * Server-side API guard (Express middleware jaisa).
 * - JWT verify karta hai
 * - Phir DB se user dobara load karta hai: deactivated users aur role changes
 *   foran enforce hote hain (purane token par trust nahi kiya jata)
 * - 401 = login nahi, 403 = role allowed nahi
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthResult> {
  const session = await auth();
  const sessionId = session?.user?.id;

  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "Unauthorized: Authentication required" }, { status: 401 }),
    };
  }

  await connectDB();
  const dbUser = await User.findById(sessionId).select("name email role facility isActive").lean();

  if (!dbUser || !dbUser.isActive) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "Unauthorized: Account is inactive" }, { status: 401 }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(dbUser.role)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: `Forbidden: Requires ${allowedRoles.join(" or ")} role` },
        { status: 403 },
      ),
    };
  }

  return {
    user: {
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      facility: dbUser.facility,
    },
    errorResponse: null,
  };
}
