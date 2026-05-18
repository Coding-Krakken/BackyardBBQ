import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const authSecret = process.env.NEXTAUTH_SECRET
  ?? (process.env.NODE_ENV !== "production" ? "bbq-local-admin-nextauth-secret" : undefined);

function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P5000") {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Can't reach database server")
    || message.includes("API Key is invalid")
    || message.includes("provided API Key is invalid");
}

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
        try {
          const customer = await prisma.customer.findUnique({
            where: { email: credentials.email.toLowerCase() }
          });

          if (!customer || !customer.passwordHash) {
            throw new Error("Invalid email or password");
          }

          // Admin app: allow all operational roles, while customer role remains blocked.
          const allowedRoles = ["owner", "admin", "manager", "staff", "accounting"];
          if (!allowedRoles.includes(customer.role)) {
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
        } catch (error) {
          if (isDatabaseUnavailableError(error)) {
            throw new Error("AUTH_SERVICE_UNAVAILABLE");
          }
          throw error;
        }
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
  secret: authSecret
};
