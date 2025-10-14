import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials")
        }

        return user
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.emailVerified = token.emailVerified as Date
      }
      return session
    },
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.emailVerified = (user as any).emailVerified
      }
      
      // Handle OAuth sign in
      if (account && profile) {
        try {
          // Check if user exists in database
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email || user.email || '' }
          })

          if (!dbUser) {
            // Create new user
            dbUser = await prisma.user.create({
              data: {
                email: profile.email || user.email || '',
                name: profile.name || user.name || null,
                image: (profile as any).picture || user.image || null,
                emailVerified: new Date(), // OAuth users are automatically verified
              }
            })
          } else {
            // Update existing user with OAuth data
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                name: profile.name || user.name || null,
                image: (profile as any).picture || user.image || null,
                emailVerified: new Date(),
                emailVerificationToken: null
              }
            })
          }

          token.id = dbUser.id
          token.emailVerified = dbUser.emailVerified
        } catch (error) {
          console.error('Error handling OAuth user:', error)
        }
      }

      return token
    },
    async signIn({ user, account, profile }) {
      // Always allow sign in
      return true
    }
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
}

