import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
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
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async signIn({ user, account, profile }) {
      // Always allow sign in, we'll handle verification in events
      return true
    }
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // For Google OAuth users, mark email as verified
      if (account?.provider === 'google') {
        console.log('Google OAuth signIn event triggered for user:', user.id, user.email, 'isNewUser:', isNewUser)
        try {
          const result = await prisma.user.update({
            where: { id: user.id },
            data: { 
              emailVerified: new Date(),
              emailVerificationToken: null
            }
          })
          console.log('Successfully updated Google user verification:', result.email, result.emailVerified)
        } catch (error) {
          console.error('Failed to update Google user verification:', error)
        }
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
}

