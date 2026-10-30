import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, UserRole } from "@/models/User";
import { loginSchema } from "@/lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        await connectDB();
        const user = await User.findOne({
          email: parsed.data.email.toLowerCase(),
        });

        if (!user || !user.isActive) {
          throw new Error("Invalid credentials or account deactivated.");
        }

        const isPasswordValid = await bcrypt.compare(
          parsed.data.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

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

/**
 * Server-side API Role Guard (Bilkul Express middleware ki tarah)
 * Agar user login nahi hai -> 401 Unauthorized
 * Agar user ka role allowed nahi hai -> 403 Forbidden
 */
export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await auth();

  if (!session || !session.user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          error: `Forbidden: Requires ${allowedRoles.join(" or ")} privileges`,
        },
        { status: 403 }
      ),
    };
  }

  return { user: session.user, errorResponse: null };
}