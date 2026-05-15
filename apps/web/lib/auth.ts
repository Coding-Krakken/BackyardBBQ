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
            : null
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
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
