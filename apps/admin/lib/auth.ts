import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const customer = await prisma.customer.findUnique({
          where: { email: credentials.email.toLowerCase() }
        });

        if (!customer || !customer.passwordHash) {
          throw new Error("Invalid email or password");
        }

        // Admin app: only allow admin and owner roles
        if (customer.role !== "admin" && customer.role !== "owner") {
          throw new Error("Access denied: admin privileges required");
        }

        const isPasswordValid = await compare(
          credentials.password,
          customer.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: customer.id,
          email: customer.email,
          name: customer.firstName
            ? `${customer.firstName} ${customer.lastName || ""}`.trim()
            : null,
          role: customer.role
        };
      }
    })
  ],
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/login",
    error: "/auth/login"
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60 // 8 hours for admin sessions
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role?: string }).role ?? "customer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string;
        (session.user as { id?: string; role?: string }).role = (token.role as string) ?? "customer";
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
